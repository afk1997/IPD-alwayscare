"use client";

import * as React from "react";
import { Camera, Play, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadFileChunked } from "@/lib/chunked-upload";
import { driveMediaUrl } from "@/lib/drive-url";
import { buildDriveFolderPath, buildDriveFileName } from "@/lib/drive-path";
import {
  savePatientMedia,
  deletePatientMedia,
  setProfilePhoto,
} from "@/actions/patient-media";
import { formatRelative } from "@/lib/date-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  fileUrl: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  isProfilePhoto: boolean;
  createdAt: Date;
  uploadedBy: { name: string };
}

interface PhotosTabProps {
  patientId: string;
  patientName: string;
  media: MediaItem[];
  isDoctor: boolean;
}

// ─── Media Viewer Dialog ─────────────────────────────────────────────────────

function MediaViewerDialog({
  item,
  open,
  onOpenChange,
  isDoctor,
}: {
  item: MediaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDoctor: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isImage = item.mimeType.startsWith("image/");
  const isVideo = item.mimeType.startsWith("video/");

  async function handleSetProfile() {
    setPending(true);
    setError(null);
    try {
      const result = await setProfilePhoto(item.id);
      if (result && "error" in result && result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success("Profile photo updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to set profile photo");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const result = await deletePatientMedia(item.id);
      if (result && "error" in result && result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success("Media deleted");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to delete media");
    } finally {
      setPending(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{item.fileName}</DialogTitle>
        </DialogHeader>

        {/* Media display */}
        <div className="flex items-center justify-center">
          {isImage && (
            <img
              src={driveMediaUrl(item.fileId)}
              alt={item.fileName}
              className="max-h-[80vh] rounded-lg object-contain"
            />
          )}
          {isVideo && (
            <video
              src={driveMediaUrl(item.fileId)}
              controls
              autoPlay
              className="max-h-[80vh] rounded-lg"
            />
          )}
        </div>

        {/* Info */}
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>Uploaded by {item.uploadedBy.name}</p>
          <p>{formatRelative(new Date(item.createdAt))}</p>
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Actions */}
        <DialogFooter className="flex-row gap-2">
          {isImage && !item.isProfilePhoto && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetProfile}
              disabled={pending}
              className="gap-1.5"
            >
              <Star className="h-3.5 w-3.5" />
              {pending ? "Setting..." : "Set as Profile"}
            </Button>
          )}

          {isDoctor && !confirmDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}

          {isDoctor && confirmDelete && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PhotosTab({
  patientId,
  patientName,
  media,
  isDoctor,
}: PhotosTabProps) {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [viewItem, setViewItem] = React.useState<MediaItem | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function triggerUpload() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const fileList = Array.from(files);
    const totalFiles = fileList.length;
    const uploadedFiles: Array<{
      fileUrl: string;
      fileId: string;
      fileName: string;
      mimeType: string;
    }> = [];

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = fileList[i];
        const folderPath = buildDriveFolderPath(patientName, "PROFILE");
        const fileName = buildDriveFileName("profile", file.name);

        const result = await uploadFileChunked(
          file,
          folderPath,
          fileName,
          (filePercent) => {
            // Overall progress: completed files + current file progress
            const overallPercent = Math.round(
              ((i * 100 + filePercent) / (totalFiles * 100)) * 100
            );
            setProgress(overallPercent);
          }
        );

        uploadedFiles.push({
          fileUrl: result.shareableLink,
          fileId: result.fileId,
          fileName: result.fileName,
          mimeType: file.type,
        });
      }

      // Save all uploaded files
      const saveResult = await savePatientMedia(patientId, uploadedFiles, false);
      if (saveResult && "error" in saveResult && saveResult.error) {
        setError(saveResult.error);
        toast.error(saveResult.error);
      } else {
        toast.success(
          `${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} uploaded`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      setProgress(0);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // ─── Empty State ────────────────────────────────────────────────────────────

  if (media.length === 0 && !uploading) {
    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="py-12 text-center">
          <Camera className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No photos or videos yet
          </p>
          <Button onClick={triggerUpload} size="sm" className="mt-3">
            Upload
          </Button>
        </div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload button + progress */}
      <div className="flex items-center gap-3">
        <Button
          onClick={triggerUpload}
          disabled={uploading}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Add Photos / Videos"}
        </Button>

        {uploading && (
          <div className="flex flex-1 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Media grid */}
      <div className="grid grid-cols-3 gap-2">
        {media.map((item) => {
          const isImage = item.mimeType.startsWith("image/");
          const isVideo = item.mimeType.startsWith("video/");

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewItem(item)}
              className="relative aspect-square overflow-hidden rounded-lg bg-muted"
            >
              {isImage && (
                <img
                  src={driveMediaUrl(item.fileId)}
                  alt={item.fileName}
                  className="h-full w-full object-cover rounded-lg"
                />
              )}
              {isVideo && (
                <>
                  <video
                    src={driveMediaUrl(item.fileId)}
                    className="h-full w-full object-cover rounded-lg"
                  />
                  {/* Play icon overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                      <Play className="h-5 w-5 text-white" fill="white" />
                    </div>
                  </div>
                </>
              )}

              {/* Profile photo star badge */}
              {item.isProfilePhoto && (
                <div className="absolute left-1 top-1">
                  <Star
                    className="h-5 w-5 text-amber-400"
                    fill="rgb(251 191 36)"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Media viewer dialog */}
      {viewItem && (
        <MediaViewerDialog
          item={viewItem}
          open={!!viewItem}
          onOpenChange={(open) => {
            if (!open) setViewItem(null);
          }}
          isDoctor={isDoctor}
        />
      )}
    </div>
  );
}
