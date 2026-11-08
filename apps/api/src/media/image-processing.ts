import { MEDIA_ALLOWED_MIME, MEDIA_VARIANT_WIDTHS, type MediaMime } from '@skytech/contracts';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

/** Largest stored rendition; originals are never kept (they may carry EXIF/GPS data). */
const FULL_MAX_WIDTH = 2560;
const MAX_INPUT_PIXELS = 50_000_000;

export interface Rendition {
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Detects the real type from the file signature (magic bytes). The client-declared MIME and
 * file extension are ignored. Returns null for anything that is not an allowed raster image
 * (SVG, HTML, PDF, executables, polyglots with a fake extension…).
 */
export async function detectImageMime(buffer: Buffer): Promise<MediaMime | null> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type) return null;
  return (MEDIA_ALLOWED_MIME as readonly string[]).includes(type.mime)
    ? (type.mime as MediaMime)
    : null;
}

/**
 * Re-encodes the image to WebP renditions. Re-encoding drops all metadata (EXIF, GPS, ICC
 * comments) and neutralises payloads hidden in the original container.
 */
export async function createRenditions(buffer: Buffer, mime: MediaMime): Promise<Rendition[]> {
  const animated = mime === 'image/gif';
  const base = () => sharp(buffer, { animated, limitInputPixels: MAX_INPUT_PIXELS }).rotate(); // apply EXIF orientation

  const render = async (name: string, width: number | undefined): Promise<Rendition> => {
    const { data, info } = await base()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    // For animations `info.height` covers all frames; the frame height is what we display.
    const pageHeight = (info as { pageHeight?: number }).pageHeight;
    return { name, buffer: data, width: info.width, height: pageHeight ?? info.height };
  };

  const full = await render('full', FULL_MAX_WIDTH);
  const variants = await Promise.all(
    MEDIA_VARIANT_WIDTHS.filter((w) => w < full.width).map((w) => render(String(w), w)),
  );
  return [full, ...variants];
}
