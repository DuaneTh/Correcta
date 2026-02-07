import sharp from 'sharp'
import { uploadFile, generateUploadKey } from '@/lib/storage/minio'

/**
 * Bounding box as percentages of page dimensions (0–100).
 * GPT outputs these when it detects a figure/image in the PDF.
 */
export interface BoundingBox {
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

/**
 * An image reference extracted by GPT: page number + crop region.
 */
export interface ImageRef {
  pageNumber: number
  boundingBox: BoundingBox
  alt: string
}

/**
 * Resolved image: the uploaded URL after cropping and storing.
 */
export interface ResolvedImage {
  url: string
  alt: string
}

/** DPI for rendering PDF pages (higher = better crops, more memory) */
const RENDER_DPI = 200
const SCALE = RENDER_DPI / 72 // PDF units are 72 DPI

/**
 * Lazy-load the mupdf WASM module.
 * mupdf uses top-level await which is incompatible with tsx/esbuild CJS transform,
 * so we must use dynamic import() to load it at runtime in an async context.
 */
let _mupdf: typeof import('mupdf') | null = null

async function getMupdf() {
  if (!_mupdf) {
    _mupdf = await import('mupdf')
  }
  return _mupdf
}

/**
 * Render a single PDF page to a PNG buffer using MuPDF WASM.
 */
async function renderPage(
  mupdf: typeof import('mupdf'),
  doc: InstanceType<typeof import('mupdf').Document>,
  pageNumber: number
): Promise<{ png: Buffer; width: number; height: number }> {
  // MuPDF pages are 0-indexed, but our pageNumber is 1-indexed
  const page = doc.loadPage(pageNumber - 1)
  const matrix = mupdf.Matrix.scale(SCALE, SCALE)
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
  const pngData = pixmap.asPNG()
  return {
    png: Buffer.from(pngData),
    width: pixmap.getWidth(),
    height: pixmap.getHeight(),
  }
}

/**
 * Crop a region from a rendered page PNG using sharp.
 *
 * @param pagePng - Full page PNG buffer
 * @param pageWidth - Rendered page width in pixels
 * @param pageHeight - Rendered page height in pixels
 * @param bbox - Bounding box as percentages (0–100)
 * @returns Cropped PNG buffer
 */
async function cropRegion(
  pagePng: Buffer,
  pageWidth: number,
  pageHeight: number,
  bbox: BoundingBox
): Promise<Buffer> {
  // Convert percentages to pixel coordinates
  const left = Math.max(0, Math.round((bbox.xPercent / 100) * pageWidth))
  const top = Math.max(0, Math.round((bbox.yPercent / 100) * pageHeight))
  let width = Math.round((bbox.widthPercent / 100) * pageWidth)
  let height = Math.round((bbox.heightPercent / 100) * pageHeight)

  // Clamp to page bounds
  if (left + width > pageWidth) width = pageWidth - left
  if (top + height > pageHeight) height = pageHeight - top

  // Minimum size guard
  width = Math.max(1, width)
  height = Math.max(1, height)

  return sharp(pagePng)
    .extract({ left, top, width, height })
    .png()
    .toBuffer()
}

/**
 * Extract, crop, and upload images from a PDF based on GPT's bounding box references.
 *
 * 1. Collects unique page numbers from all image refs
 * 2. Renders each referenced page once at high DPI
 * 3. Crops each bounding box region
 * 4. Uploads each crop to MinIO
 * 5. Returns resolved images in the same order as imageRefs
 *
 * @param pdfBuffer - Raw PDF file bytes
 * @param imageRefs - Array of image references with page + bbox from GPT
 * @returns Array of resolved images (same order as imageRefs)
 */
export async function extractAndUploadImages(
  pdfBuffer: Buffer,
  imageRefs: ImageRef[]
): Promise<ResolvedImage[]> {
  if (imageRefs.length === 0) return []

  const mupdf = await getMupdf()

  // Open the PDF document
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const pageCount = doc.countPages()

  // Collect unique page numbers and render each once
  const uniquePages = [...new Set(imageRefs.map((r) => r.pageNumber))]
  const renderedPages = new Map<number, { png: Buffer; width: number; height: number }>()

  for (const pageNum of uniquePages) {
    if (pageNum < 1 || pageNum > pageCount) {
      console.warn(`[Image Extractor] Page ${pageNum} out of range (1–${pageCount}), skipping`)
      continue
    }
    console.log(`[Image Extractor] Rendering page ${pageNum} at ${RENDER_DPI} DPI...`)
    renderedPages.set(pageNum, await renderPage(mupdf, doc, pageNum))
  }

  // Process each image reference: crop and upload
  const results: ResolvedImage[] = []

  for (let i = 0; i < imageRefs.length; i++) {
    const ref = imageRefs[i]
    const rendered = renderedPages.get(ref.pageNumber)

    if (!rendered) {
      console.warn(`[Image Extractor] No rendered page for image ref ${i} (page ${ref.pageNumber}), skipping`)
      results.push({ url: '', alt: ref.alt })
      continue
    }

    try {
      // Crop the bounding box region
      const croppedPng = await cropRegion(rendered.png, rendered.width, rendered.height, ref.boundingBox)

      // Upload to MinIO
      const key = generateUploadKey(`pdf-figure-p${ref.pageNumber}-${i}.png`)
      const url = await uploadFile(key, croppedPng, 'image/png')

      console.log(`[Image Extractor] Uploaded figure ${i} from page ${ref.pageNumber} → ${url}`)
      results.push({ url, alt: ref.alt })
    } catch (err) {
      console.error(`[Image Extractor] Failed to process image ref ${i}:`, err)
      results.push({ url: '', alt: ref.alt })
    }
  }

  return results
}
