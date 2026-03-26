export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth";
import { RegistrationForm } from "@/components/forms/registration-form";

export default async function NewPatientPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Register New Patient</h2>
      <RegistrationForm isDoctor={session.role === "DOCTOR"} />
    </div>
  );
}
