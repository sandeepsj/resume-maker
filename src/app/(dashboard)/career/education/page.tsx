"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Education } from "@/lib/models/Education";
import EducationManager from "./EducationManager";
import type { EducationData } from "@/types/career";

export default async function EducationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const rawEducations = await Education.find({ userId: session.user.id })
    .sort({ endDate: -1 })
    .lean();

  const educations: EducationData[] = rawEducations.map((e) => ({
    id: e._id.toString(),
    institution: e.institution,
    degree: e.degree,
    field: e.field ?? null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate ? e.endDate.toISOString() : null,
    gpa: e.gpa ?? null,
    honors: e.honors ?? null,
    activities: e.activities,
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <EducationManager initialEducations={educations} />
    </div>
  );
}
