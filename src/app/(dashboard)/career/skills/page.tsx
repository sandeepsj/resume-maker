"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Skill } from "@/lib/models/Skill";
import SkillsManager from "./SkillsManager";
import type { SkillData } from "@/types/career";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const rawSkills = await Skill.find({ userId: session.user.id })
    .sort({ category: 1, name: 1 })
    .lean();

  const skills: SkillData[] = rawSkills.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    category: s.category,
    level: s.level,
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <SkillsManager initialSkills={skills} />
    </div>
  );
}
