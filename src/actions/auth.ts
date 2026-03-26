"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function login(_prevState: any, formData: FormData) {
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;

  if (!phone || !password) {
    return { error: "Phone and password are required" };
  }

  const staff = await db.staff.findUnique({ where: { phone } });
  if (!staff || !staff.isActive) {
    return { error: "Invalid phone number or password" };
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    return { error: "Invalid phone number or password" };
  }

  await createSession(staff.id, staff.role);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
