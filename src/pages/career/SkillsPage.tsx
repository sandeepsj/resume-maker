import { useState, useEffect } from "react";
import { getSkills } from "@/lib/google-drive";
import { SkillsManager } from "@/components/SkillsManager";
import type { SkillData } from "@/types/career";

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillData[] | null>(null);

  useEffect(() => {
    getSkills().then(setSkills).catch(console.error);
  }, []);

  if (!skills) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-32 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <SkillsManager initialSkills={skills} />
    </div>
  );
}
