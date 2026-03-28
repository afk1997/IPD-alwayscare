/**
 * Convert a Google Drive fileId to a direct content URL that works in <img> and <video> tags.
 *
 * webViewLink URLs (drive.google.com/file/d/.../view) are web pages, not media.
 * We use the direct download endpoint instead.
 */
export function driveMediaUrl(fileId: string): string {
  if (!fileId || fileId === "SKIPPED") return "";
  return `https://drive.google.com/uc?id=${fileId}&export=view`;
}

export function driveThumbnailUrl(fileId: string, size = 400): string {
  if (!fileId || fileId === "SKIPPED") return "";
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}
