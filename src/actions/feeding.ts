"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireAuth } from "@/lib/auth";

export async function createDietPlan(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const dietType = formData.get("dietType") as string;
  const instructions = (formData.get("instructions") as string) || undefined;
  const schedulesRaw = formData.get("schedules") as string;

  if (!dietType) return { error: "Diet type is required" };

  let schedules: Array<{ scheduledTime: string; foodType: string; portion: string }> = [];
  if (schedulesRaw) {
    try {
      schedules = JSON.parse(schedulesRaw);
    } catch {
      return { error: "Invalid schedules format" };
    }
  }

  // Deactivate all existing active diet plans
  await db.dietPlan.updateMany({
    where: { admissionId, isActive: true },
    data: { isActive: false },
  });

  // Create new diet plan with feeding schedules
  await db.dietPlan.create({
    data: {
      admissionId,
      dietType,
      instructions,
      isActive: true,
      createdById: session.staffId,
      feedingSchedules: {
        create: schedules.map((s) => ({
          scheduledTime: s.scheduledTime,
          foodType: s.foodType,
          portion: s.portion,
        })),
      },
    },
  });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}

export async function logFeeding(feedingScheduleId: string, formData: FormData) {
  const session = await requireAuth();

  const status = formData.get("status") as string;
  const amountConsumed = (formData.get("amountConsumed") as string) || undefined;
  const notes = (formData.get("notes") as string) || undefined;
  const dateStr = formData.get("date") as string;

  if (!status) return { error: "Status is required" };
  if (!dateStr) return { error: "Date is required" };

  const validStatuses = ["EATEN", "PARTIAL", "REFUSED", "SKIPPED"];
  if (!validStatuses.includes(status)) return { error: "Invalid status" };

  const date = new Date(dateStr);

  // Find the feeding schedule to get admissionId for revalidation
  const feedingSchedule = await db.feedingSchedule.findUnique({
    where: { id: feedingScheduleId },
    select: { dietPlan: { select: { admissionId: true } } },
  });

  if (!feedingSchedule) return { error: "Feeding schedule not found" };

  // Upsert feeding log for today
  await db.feedingLog.upsert({
    where: { feedingScheduleId_date: { feedingScheduleId, date } },
    create: {
      feedingScheduleId,
      date,
      status: status as "EATEN" | "PARTIAL" | "REFUSED" | "SKIPPED",
      amountConsumed,
      notes,
      loggedById: session.staffId,
    },
    update: {
      status: status as "EATEN" | "PARTIAL" | "REFUSED" | "SKIPPED",
      amountConsumed,
      notes,
      loggedById: session.staffId,
    },
  });

  revalidatePath(`/patients/${feedingSchedule.dietPlan.admissionId}`);
  return { success: true };
}
