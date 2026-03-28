/**
 * Convert a Google Drive fileId to a URL that works in <img> and <video> tags.
 *
 * Google Drive blocks direct hotlinking for service-account files.
 * We proxy through our own /api/media endpoint which fetches via the Drive API.
 */
export function driveMediaUrl(fileId: string): string {
  if (!fileId || fileId === "SKIPPED") return "";
  return `/api/media?id=${encodeURIComponent(fileId)}`;
}
