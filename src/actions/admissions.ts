"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function registerPatient(_prevState: any, formData: FormData) {
  const session = await requireAuth();

  const name = formData.get("name") as string;
  const species = (formData.get("species") as string) || "DOG";
  const breed = (formData.get("breed") as string) || undefined;
  const age = (formData.get("age") as string) || undefined;
  const weightStr = formData.get("weight") as string;
  const weight = weightStr ? parseFloat(weightStr) : undefined;
  const sex = (formData.get("sex") as string) || "UNKNOWN";
  const color = (formData.get("color") as string) || undefined;
  const photoUrl = (formData.get("photoUrl") as string) || undefined;
  const isStray = formData.get("isStray") === "true";
  const rescueLocation = (formData.get("rescueLocation") as string) || undefined;
  const rescuerInfo = (formData.get("rescuerInfo") as string) || undefined;

  if (!name) return { error: "Patient name is required" };

  const result = await db.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        name,
        species: species as any,
        breed,
        age,
        weight,
        sex: sex as any,
        color,
        photoUrl,
        isStray,
        rescueLocation,
        rescuerInfo,
      },
    });

    const admission = await tx.admission.create({
      data: {
        patientId: patient.id,
        admittedById: session.staffId,
        status: "REGISTERED",
      },
    });

    return { patientId: patient.id, admissionId: admission.id };
  });

  revalidatePath("/");
  return { success: true, admissionId: result.admissionId };
}
