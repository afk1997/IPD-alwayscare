export function isVideo(fileName: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv)$/i.test(fileName);
}
