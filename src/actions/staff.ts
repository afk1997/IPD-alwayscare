"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateStaffRole } from "@/lib/validators";
import { handleActionError } from "@/lib/action-utils";

function assertAdminOrDoctor(role: string) {
  if (role !== "ADMIN" && role !== "DOCTOR") {
    throw new Error("Forbidden: Admin or Doctor access required");
  }
}

export async function createStaff(_prevState: unknown, formData: FormData) {
  try {
    const session = await requireAuth();
    assertAdminOrDoctor(session.role);

    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;

    if (!name || !phone || !password || !role) {
      return { error: "All fields are required" };
    }

    if (password.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }

    const validatedRole = validateStaffRole(role);

    // Prevent privilege escalation: only ADMIN can create ADMIN accounts
    if (validatedRole === "ADMIN" && session.role !== "ADMIN") {
      return { error: "Only admins can create admin accounts" };
    }

    const existing = await db.staff.findUnique({ where: { phone } });
    if (existing) {
      if (existing.deletedAt) {
        return { error: "This phone number belongs to a deleted account. Use a different number." };
      }
      return { error: "A staff member with this phone number already exists" };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.staff.create({
      data: { name, phone, passwordHash, role: validatedRole },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleStaffActive(staffId: string) {
  try {
    const session = await requireAuth();
    assertAdminOrDoctor(session.role);

    const staff = await db.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return { error: "Staff member not found" };
    }
    if (staff.deletedAt) {
      return { error: "Cannot modify a deleted staff member" };
    }

    // Prevent privilege escalation: only ADMIN can modify ADMIN accounts
    if (staff.role === "ADMIN" && session.role !== "ADMIN") {
      return { error: "Only admins can modify admin accounts" };
    }

    const newActive = !staff.isActive;

    await db.staff.update({
      where: { id: staffId },
      data: { isActive: newActive },
    });

    // If deactivating, delete all sessions to force logout
    if (!newActive) {
      await db.session.deleteMany({ where: { staffId } });
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function resetStaffPassword(staffId: string, newPassword: string) {
  try {
    const session = await requireAuth();
    assertAdminOrDoctor(session.role);

    if (!newPassword || newPassword.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }

    const staff = await db.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return { error: "Staff member not found" };
    }
    if (staff.deletedAt) {
      return { error: "Cannot modify a deleted staff member" };
    }

    // Prevent privilege escalation: only ADMIN can reset ADMIN passwords
    if (staff.role === "ADMIN" && session.role !== "ADMIN") {
      return { error: "Only admins can reset admin passwords" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.staff.update({
      where: { id: staffId },
      data: { passwordHash },
    });

    // Invalidate all existing sessions
    await db.session.deleteMany({ where: { staffId } });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function addCage(_prevState: unknown, formData: FormData) {
  try {
    const session = await requireAuth();
    assertAdminOrDoctor(session.role);

    const ward = formData.get("ward") as string;
    const cageNumber = (formData.get("cageNumber") as string)?.trim();

    if (!ward || !cageNumber) {
      return { error: "Ward and cage number are required" };
    }

    const validWards = ["GENERAL", "ISOLATION", "ICU"];
    if (!validWards.includes(ward)) {
      return { error: "Invalid ward" };
    }

    const existing = await db.cageConfig.findUnique({
      where: { ward_cageNumber: { ward: ward as "GENERAL" | "ISOLATION" | "ICU", cageNumber } },
    });
    if (existing) {
      return { error: "A cage with this ward and number already exists" };
    }

    await db.cageConfig.create({
      data: { ward: ward as "GENERAL" | "ISOLATION" | "ICU", cageNumber },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleCageActive(cageId: string) {
  try {
    const session = await requireAuth();
    assertAdminOrDoctor(session.role);

    const cage = await db.cageConfig.findUnique({ where: { id: cageId } });
    if (!cage) {
      return { error: "Cage not found" };
    }

    await db.cageConfig.update({
      where: { id: cageId },
      data: { isActive: !cage.isActive },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteStaff(staffId: string) {
  try {
    const session = await requireAuth();
    if (session.role !== "ADMIN") {
      return { error: "Forbidden: Admin only" };
    }

    // Can't delete yourself
    if (session.staffId === staffId) {
      return { error: "You cannot delete your own account" };
    }

    const staff = await db.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return { error: "Staff member not found" };
    }
    if (staff.deletedAt) {
      return { error: "Staff member is already deleted" };
    }

    // Prevent deleting the last active admin
    if (staff.role === "ADMIN") {
      const adminCount = await db.staff.count({
        where: { role: "ADMIN", isActive: true, deletedAt: null, id: { not: staffId } },
      });
      if (adminCount === 0) {
        return { error: "Cannot delete the last active admin" };
      }
    }

    // Soft-delete + session purge in a single transaction
    await db.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: staffId },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.session.deleteMany({ where: { staffId } });
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteCage(cageId: string) {
  try {
    const session = await requireAuth();
    if (session.role !== "ADMIN") {
      return { error: "Forbidden: Admin only" };
    }

    const cage = await db.cageConfig.findUnique({ where: { id: cageId } });
    if (!cage) {
      return { error: "Cage not found" };
    }

    // Check if any active patient is in this cage
    const occupied = await db.admission.findFirst({
      where: {
        ward: cage.ward,
        cageNumber: cage.cageNumber,
        status: { in: ["ACTIVE", "REGISTERED"] },
        deletedAt: null,
      },
    });

    if (occupied) {
      return { error: "Cage is occupied by an active patient. Move the patient first." };
    }

    // Hard-delete the cage
    await db.cageConfig.delete({ where: { id: cageId } });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
