import { useState, useEffect } from "react";
import { getEducation } from "@/lib/google-drive";
import { EducationManager } from "@/components/EducationManager";
import type { EducationData } from "@/types/career";

export function EducationPage() {
  const [education, setEducation] = useState<EducationData[] | null>(null);

  useEffect(() => {
    getEducation().then(setEducation).catch(console.error);
  }, []);

  if (!education) {
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
      <EducationManager initialEducations={education} />
    </div>
  );
}
