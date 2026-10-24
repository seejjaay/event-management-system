/**
 * Turns a user-picked image into a small square WebP data URL for profile pictures:
 * centre-crop, scale down to `size`px and re-encode, so uploads stay around 10-30KB even from
 * a multi-megabyte phone photo (the server rejects anything over 200KB).
 */
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export async function fileToAvatarDataUrl(file, { size = 256 } = {}) {
  if (!file || !AVATAR_ACCEPT.split(',').includes(file.type)) {
    throw new Error('Please choose a PNG, JPEG or WebP image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That image is too large. Please choose one under 10 MB.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That file could not be read as an image.');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  );
  bitmap.close?.();

  // Try WebP first, then lower qualities if a very detailed image is still too big
  for (const quality of [0.85, 0.7, 0.5]) {
    const dataUrl = canvas.toDataURL('image/webp', quality);
    if (dataUrl.startsWith('data:image/webp') && dataUrl.length * 0.75 < 180 * 1024) return dataUrl;
  }
  // Browsers without WebP encoding fall back to PNG, which is fine at this size
  const png = canvas.toDataURL('image/png');
  if (png.length * 0.75 < 180 * 1024) return png;
  throw new Error('That image is too detailed to use. Try a simpler one.');
}
