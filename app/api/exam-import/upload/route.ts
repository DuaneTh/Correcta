import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { uploadFile, generateUploadKey } from '@/lib/storage/minio'
import { pdfImportQueue } from '@/lib/queue'
import { verifyCsrf, getCsrfCookieToken } from '@/lib/csrf'

/**
 * POST /api/exam-import/upload
 *
 * Upload a PDF file for exam import via AI extraction.
 * Validates PDF type/size, stores in MinIO, enqueues BullMQ job.
 *
 * Authentication: Requires teacher role (TEACHER, SCHOOL_ADMIN, or PLATFORM_ADMIN)
 * Authorization: CSRF token required (mutation endpoint)
 *
 * Request: multipart/form-data with 'file' field (PDF) and 'courseId' field
 * Response: { jobId: string, status: 'processing' } - Job ID for polling
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not a teacher / CSRF verification failed
 * - 400: No file provided / Not a PDF / File too large / No courseId
 * - 503: Queue not available
 * - 500: Upload failed
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getAuthSession(request)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check authorization - only teachers can import
    if (!isTeacher(session)) {
      return NextResponse.json(
        { error: 'Teacher role required to import exams' },
        { status: 403 }
      )
    }

    // Verify CSRF token (mutation endpoint)
    const cookieToken = getCsrfCookieToken(request)
    const headerToken = request.headers.get('x-csrf-token')
    const csrfResult = verifyCsrf({
      req: request,
      cookieToken,
      headerToken,
    })

    if (!csrfResult.ok) {
      return NextResponse.json(
        { error: 'CSRF verification failed' },
        { status: 403 }
      )
    }

    // Check if queue is available
    if (!pdfImportQueue) {
      return NextResponse.json(
        { error: 'Queue not available' },
        { status: 503 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const courseId = formData.get('courseId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Seuls les fichiers PDF sont acceptes' },
        { status: 400 }
      )
    }

    // Validate file size (32 MB limit)
    const MAX_PDF_SIZE = 32 * 1024 * 1024
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: 'Le PDF depasse la limite de 32 Mo' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique key
    const key = generateUploadKey(file.name)

    // Upload to MinIO
    await uploadFile(key, buffer, file.type)

    // Enqueue job
    const job = await pdfImportQueue.add('import-exam', {
      userId: session.user.id,
      pdfKey: key,
      institutionId: session.user.institutionId,
      courseId,
    })

    return NextResponse.json({
      jobId: job.id,
      status: 'processing',
    })
  } catch (error) {
    console.error('[PDF Import] Upload error:', error)

    // Check for MinIO configuration errors
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { error: 'File storage not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
