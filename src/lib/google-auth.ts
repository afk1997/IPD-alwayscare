import { google } from "googleapis";

export function getGoogleAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  const credentials = JSON.parse(Buffer.from(key, "base64").toString());
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

export function getGoogleDrive() {
  const auth = getGoogleAuth();
  return google.drive({ version: "v3", auth });
}

/**
 * Best-effort rename of a single file in Google Drive.
 * Errors are logged but never thrown so callers are not blocked.
 */
export async function renameFileInDrive(
  fileId: string,
  newName: string
): Promise<void> {
  try {
    const drive = getGoogleDrive();
    await drive.files.update({
      fileId,
      requestBody: { name: newName },
      supportsAllDrives: true,
    });
  } catch (error) {
    console.error(
      `[Drive] Failed to rename file ${fileId} to "${newName}":`,
      error
    );
  }
}

/**
 * Rename proof attachment files in Google Drive to "DELETED - originalname".
 * Skips proofs where fileId is "SKIPPED" or falsy.
 * Best-effort: errors are logged, never thrown.
 */
export async function markDeletedInDrive(
  proofs: Array<{ fileId: string | null; fileName: string | null }>
): Promise<void> {
  await Promise.allSettled(
    proofs
      .filter((p) => p.fileId && p.fileId !== "SKIPPED")
      .map((p) => renameFileInDrive(p.fileId!, `DELETED - ${p.fileName ?? "unknown"}`))
  );
}
