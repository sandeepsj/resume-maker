import { useState, useEffect } from "react";
import { getExperiences } from "@/lib/google-drive";
import { ExperienceManager } from "@/components/ExperienceManager";
import type { ExperienceData } from "@/types/career";

export function ExperiencePage() {
  const [experiences, setExperiences] = useState<ExperienceData[] | null>(null);

  useEffect(() => {
    getExperiences().then(setExperiences).catch(console.error);
  }, []);

  if (!experiences) {
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
      <ExperienceManager initialExperiences={experiences} />
    </div>
  );
}
