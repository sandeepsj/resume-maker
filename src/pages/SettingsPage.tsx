import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/lib/google-drive";
import { ProfileForm } from "@/components/ProfileForm";
import type { UserProfileData } from "@/types/career";

export function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          This information is used when generating your resumes.
        </p>
      </div>
      <ProfileForm
        initialProfile={profile}
        userName={user?.name ?? ""}
        userEmail={user?.email ?? ""}
      />
    </div>
  );
}
