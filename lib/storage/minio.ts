import * as Minio from 'minio'
import * as fs from 'fs'
import * as path from 'path'

/**
 * MinIO client configuration for exam asset storage
 *
 * Required environment variables:
 * - MINIO_ENDPOINT: MinIO server URL (e.g., 'localhost' or 'minio.example.com')
 * - MINIO_PORT: Port number (e.g., 9000)
 * - MINIO_USE_SSL: Whether to use SSL (true/false)
 * - MINIO_ACCESS_KEY: Access key for authentication
 * - MINIO_SECRET_KEY: Secret key for authentication
 * - MINIO_BUCKET: Default bucket name for uploads
 * - MINIO_PUBLIC_URL: Public URL for accessing objects (optional, defaults to endpoint)
 *
 * If MinIO is not configured, files will be stored locally in /public/uploads (dev fallback)
 */

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost'
const minioPort = parseInt(process.env.MINIO_PORT || '9000', 10)
const minioUseSSL = process.env.MINIO_USE_SSL === 'true'
const minioAccessKey = process.env.MINIO_ACCESS_KEY || ''
const minioSecretKey = process.env.MINIO_SECRET_KEY || ''
const minioRegion = process.env.MINIO_REGION || ''

/**
 * Check if MinIO is configured
 */
export function isMinioConfigured(): boolean {
  return !!(minioAccessKey && minioSecretKey)
}

/**
 * MinIO client singleton - lazily initialized
 */
let minioClient: Minio.Client | null = null

export function getMinioClient(): Minio.Client {
  if (!minioClient) {
    if (!minioAccessKey || !minioSecretKey) {
      throw new Error('MinIO credentials not configured. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY.')
    }
    minioClient = new Minio.Client({
      endPoint: minioEndpoint,
      port: minioPort,
      useSSL: minioUseSSL,
      accessKey: minioAccessKey,
      secretKey: minioSecretKey,
      ...(minioRegion ? { region: minioRegion } : {}),
    })
  }
  return minioClient
}

/**
 * Default bucket name for exam assets
 */
export const DEFAULT_BUCKET = process.env.MINIO_BUCKET || 'exam-assets'

/**
 * Ensure bucket exists, creating it if necessary
 */
export async function ensureBucket(bucket: string = DEFAULT_BUCKET): Promise<void> {
  const client = getMinioClient()
  const exists = await client.bucketExists(bucket)
  if (!exists) {
    await client.makeBucket(bucket)
    // Set bucket policy to allow public read access for exam assets
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    }
    await client.setBucketPolicy(bucket, JSON.stringify(policy))
  }
}

/**
 * Local storage directory for development fallback
 */
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

/**
 * Upload a file buffer to local storage (dev fallback)
 */
async function uploadFileLocal(
  key: string,
  buffer: Buffer
): Promise<string> {
  // Ensure upload directory exists
  const filePath = path.join(LOCAL_UPLOAD_DIR, key)
  const fileDir = path.dirname(filePath)

  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true })
  }

  // Write file
  fs.writeFileSync(filePath, buffer)

  // Return public URL (relative to /public)
  return `/uploads/${key}`
}

/**
 * Upload a file buffer to MinIO or local storage
 *
 * @param key - Object key (path within bucket)
 * @param buffer - File content as Buffer
 * @param contentType - MIME type of the file
 * @param bucket - Optional bucket name (defaults to DEFAULT_BUCKET)
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
  bucket: string = DEFAULT_BUCKET
): Promise<string> {
  // Use local storage if MinIO is not configured
  if (!isMinioConfigured()) {
    return uploadFileLocal(key, buffer)
  }

  const client = getMinioClient()

  // Ensure bucket exists
  await ensureBucket(bucket)

  // Upload file
  await client.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': contentType,
  })

  // Return public URL
  return getPublicUrl(bucket, key)
}

/**
 * Generate a presigned URL for direct client uploads
 *
 * @param bucket - Bucket name
 * @param key - Object key
 * @param expiry - URL expiry in seconds (default 1 hour)
 * @returns Presigned PUT URL
 */
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  expiry: number = 3600
): Promise<string> {
  const client = getMinioClient()
  return client.presignedPutObject(bucket, key, expiry)
}

/**
 * Generate a presigned URL for downloading/viewing
 *
 * @param bucket - Bucket name
 * @param key - Object key
 * @param expiry - URL expiry in seconds (default 1 hour)
 * @returns Presigned GET URL
 */
export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiry: number = 3600
): Promise<string> {
  const client = getMinioClient()
  return client.presignedGetObject(bucket, key, expiry)
}

/**
 * Download a file as a Buffer from MinIO or local storage
 *
 * @param key - Object key
 * @param bucket - Optional bucket name (defaults to DEFAULT_BUCKET)
 * @returns File content as Buffer
 */
export async function downloadFile(
  key: string,
  bucket: string = DEFAULT_BUCKET
): Promise<Buffer> {
  if (!isMinioConfigured()) {
    // Local storage fallback
    const filePath = path.join(LOCAL_UPLOAD_DIR, key)
    return fs.readFileSync(filePath) as Buffer
  }

  const client = getMinioClient()
  const stream = await client.getObject(bucket, key)

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/**
 * Delete an object from MinIO
 *
 * @param bucket - Bucket name
 * @param key - Object key
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const client = getMinioClient()
  await client.removeObject(bucket, key)
}

/**
 * Get the public URL for an object
 * With public bucket policy, objects can be accessed directly
 */
export function getPublicUrl(bucket: string, key: string): string {
  const publicUrl = process.env.MINIO_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${bucket}/${key}`
  }
  const protocol = minioUseSSL ? 'https' : 'http'
  return `${protocol}://${minioEndpoint}:${minioPort}/${bucket}/${key}`
}

/**
 * Generate a unique key for uploaded files
 * Format: uploads/{date}/{uuid}-{original-filename}
 */
export function generateUploadKey(originalFilename: string): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const uuid = crypto.randomUUID()
  // Sanitize filename: remove special chars, keep extension
  const sanitized = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
  return `uploads/${date}/${uuid}-${sanitized}`
}

/**
 * Validate file type for image uploads
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]
  return validTypes.includes(mimeType)
}

/**
 * Maximum file size for uploads (10 MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024
