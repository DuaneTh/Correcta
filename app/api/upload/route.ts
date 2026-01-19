import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import {
  uploadFile,
  generateUploadKey,
  isValidImageType,
  MAX_FILE_SIZE,
} from '@/lib/storage/minio'

/**
 * POST /api/upload
 *
 * Upload an image file to MinIO storage.
 * Proxies the upload through Next.js to avoid CORS issues with MinIO in dev.
 *
 * Authentication: Requires teacher role (TEACHER, SCHOOL_ADMIN, or PLATFORM_ADMIN)
 *
 * Request: multipart/form-data with 'file' field
 * Response: { url: string } - Public URL of uploaded file
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not a teacher
 * - 400: No file provided / Invalid file type / File too large
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

    // Check authorization - only teachers can upload
    if (!isTeacher(session)) {
      return NextResponse.json(
        { error: 'Teacher role required to upload files' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique key
    const key = generateUploadKey(file.name)

    // Upload to MinIO
    const url = await uploadFile(key, buffer, file.type)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)

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

/**
 * GET /api/upload
 *
 * Health check for upload service
 */
export async function GET() {
  try {
    // Check if MinIO is configured (don't actually connect)
    const isConfigured = !!(
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY
    )

    return NextResponse.json({
      status: isConfigured ? 'ready' : 'not_configured',
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    })
  } catch {
    return NextResponse.json(
      { status: 'error' },
      { status: 500 }
    )
  }
}
