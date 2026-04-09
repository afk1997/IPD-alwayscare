"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, X, Film } from "lucide-react";
import { registerPatient } from "@/actions/admissions";
import { uploadFileChunked } from "@/lib/chunked-upload";
import { savePatientMedia } from "@/actions/patient-media";
import { buildDriveFolderPath, buildDriveFileName } from "@/lib/drive-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegistrationFormProps {
  isDoctor?: boolean;
}

export function RegistrationForm({ isDoctor = false }: RegistrationFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerPatient, null);
  const [isStray, setIsStray] = useState(false);
  const [species, setSpecies] = useState("DOG");
  const [sex, setSex] = useState("UNKNOWN");
  const [handlingNote, setHandlingNote] = useState("STANDARD");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) return;
    if ("error" in state && state.error) {
      toast.error(state.error);
      return;
    }
    if (!("success" in state && state.success)) return;

    const patientId = "patientId" in state ? (state.patientId as string) : null;
    const admissionId = "admissionId" in state ? (state.admissionId as string) : null;
    const patientName = (document.querySelector<HTMLInputElement>("#name")?.value) || "Patient";

    // Upload files if any were selected, then redirect
    if ((selectedFiles.length > 0 || locationPhoto) && patientId) {
      let cancelled = false;
      setIsUploading(true);

      (async () => {
        try {
          const uploadedFiles: Array<{ fileUrl: string; fileId: string; fileName: string; mimeType: string }> = [];

          for (const file of selectedFiles) {
            if (cancelled) return;
            const folderPath = buildDriveFolderPath(patientName, "PROFILE");
            const fileName = buildDriveFileName("profile", file.name);
            const result = await uploadFileChunked(file, folderPath, fileName);
            uploadedFiles.push({
              fileUrl: result.shareableLink,
              fileId: result.fileId,
              fileName: result.fileName,
              mimeType: file.type,
            });
          }

          if (!cancelled && uploadedFiles.length > 0) {
            await savePatientMedia(patientId, uploadedFiles, true);
          }

          const locationUploads: Array<{
            fileUrl: string;
            fileId: string;
            fileName: string;
            mimeType: string;
          }> = [];

          if (locationPhoto) {
            const result = await uploadFileChunked(
              locationPhoto,
              buildDriveFolderPath(patientName, "LOCATION"),
              buildDriveFileName("location", locationPhoto.name)
            );

            locationUploads.push({
              fileUrl: result.shareableLink,
              fileId: result.fileId,
              fileName: result.fileName,
              mimeType: locationPhoto.type,
            });
          }

          if (!cancelled && locationUploads.length > 0) {
            await savePatientMedia(patientId, locationUploads, false);
          }

          toast.success("Patient registered");
        } catch {
          toast.warning("Patient registered, but photo upload failed. You can add photos later.");
        } finally {
          if (!cancelled) {
            setIsUploading(false);
            if (isDoctor && admissionId) {
              router.push(`/patients/${admissionId}/setup`);
            } else {
              router.push("/");
            }
          }
        }
      })();

      return () => { cancelled = true; };
    }

    // No files to upload — redirect immediately
    toast.success("Patient registered");
    if (isDoctor && admissionId) {
      router.push(`/patients/${admissionId}/setup`);
    } else {
      router.push("/");
    }
  }, [state, router, isDoctor, selectedFiles, locationPhoto]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLocationPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLocationPhoto(file);
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Patient Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          {/* Hidden fields for controlled select/switch values */}
          <input type="hidden" name="species" value={species} />
          <input type="hidden" name="sex" value={sex} />
          <input type="hidden" name="isStray" value={String(isStray)} />
          <input type="hidden" name="handlingNote" value={handlingNote} />

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Patient Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g., Bruno"
              className="h-12"
            />
          </div>

          {/* Species + Sex */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Species</Label>
              <Select value={species} onValueChange={(v) => setSpecies(v ?? "DOG")}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOG">Dog</SelectItem>
                  <SelectItem value="CAT">Cat</SelectItem>
                  <SelectItem value="BIRD">Bird</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v ?? "UNKNOWN")}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breed */}
          <div className="space-y-1.5">
            <Label htmlFor="breed">Breed</Label>
            <Input
              id="breed"
              name="breed"
              placeholder="e.g., Indian Pariah, Labrador Mix"
              className="h-12"
            />
          </div>

          {/* Age + Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                name="age"
                placeholder="e.g., ~3 years, 4 months"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="kg"
                className="h-12"
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label htmlFor="color">Color / Markings</Label>
            <Input
              id="color"
              name="color"
              placeholder="e.g., Brown with white patch"
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ambulancePersonName">Ambulance Person Name</Label>
            <Input
              id="ambulancePersonName"
              name="ambulancePersonName"
              placeholder="e.g., Rahul"
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rescueLocation">Location Name</Label>
            <Input
              id="rescueLocation"
              name="rescueLocation"
              placeholder="e.g., Near Andheri Station, Mumbai"
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="locationGpsCoordinates">GPS Coordinates</Label>
            <Input
              id="locationGpsCoordinates"
              name="locationGpsCoordinates"
              placeholder="e.g., 19.0760, 72.8777"
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Handling Note</Label>
            <Select
              value={handlingNote}
              onValueChange={(value) => setHandlingNote(value ?? "STANDARD")}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="GENTLE">Gentle</SelectItem>
                <SelectItem value="ADVANCED_HANDLER_ONLY">
                  Advanced handler only
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Photos/Videos upload */}
          <div className="space-y-2">
            <Label>Photos / Videos</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Add Photos / Videos
            </Button>
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="relative">
                    {file.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Film className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Location Photo</Label>
            <input
              ref={locationPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLocationPhotoSelected}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              onClick={() => locationPhotoInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Add Location Photo
            </Button>
            {locationPhoto && (
              <div className="relative inline-block">
                <img
                  src={URL.createObjectURL(locationPhoto)}
                  alt={locationPhoto.name}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setLocationPhoto(null)}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Is Stray toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Is this a stray animal?</p>
              <p className="text-xs text-muted-foreground">
                Toggle on for rescued/stray patients
              </p>
            </div>
            <Switch
              checked={isStray}
              onCheckedChange={setIsStray}
            />
          </div>

          {/* Stray-specific fields */}
          {isStray && (
            <div className="space-y-4 rounded-lg bg-muted/50 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="rescueLocation">Rescue Location</Label>
                <Input
                  id="rescueLocation"
                  name="rescueLocation"
                  placeholder="e.g., Near Andheri Station, Mumbai"
                  className="h-12"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rescuerInfo">Rescuer Info</Label>
                <Input
                  id="rescuerInfo"
                  name="rescuerInfo"
                  placeholder="e.g., Priya Sharma, 9876543210"
                  className="h-12"
                />
              </div>
            </div>
          )}

          {/* Doctor note */}
          {isDoctor && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 text-center">
              Clinical setup (diagnosis, ward, cage, medications) will be
              available after registration.
            </p>
          )}

          {/* Upload progress */}
          {isUploading && (
            <p className="text-sm text-muted-foreground text-center animate-pulse">
              Uploading photos...
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={isPending || isUploading}
          >
            {isUploading ? "Uploading photos..." : isPending ? "Registering..." : "Register Patient"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
