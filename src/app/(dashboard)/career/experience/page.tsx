"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Experience } from "@/lib/models/Experience";
import ExperienceManager from "./ExperienceManager";
import type { ExperienceData } from "@/types/career";

export default async function ExperiencePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const rawExperiences = await Experience.find({ userId: session.user.id })
    .sort({ startDate: -1 })
    .lean();

  const experiences: ExperienceData[] = rawExperiences.map((e) => ({
    id: e._id.toString(),
    company: e.company,
    title: e.title,
    location: e.location ?? null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate ? e.endDate.toISOString() : null,
    isCurrent: e.isCurrent,
    description: e.description,
    highlights: e.highlights,
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <ExperienceManager initialExperiences={experiences} />
    </div>
  );
}
