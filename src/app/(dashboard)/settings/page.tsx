"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserProfile } from "@/lib/models/UserProfile";
import ProfileForm from "./ProfileForm";
import type { UserProfileData } from "@/types/career";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const rawProfile = await UserProfile.findOneAndUpdate(
    { userId: session.user.id },
    { $setOnInsert: { userId: session.user.id } },
    { upsert: true, new: true }
  ).lean();

  const profile: UserProfileData = {
    id: rawProfile._id.toString(),
    headline: rawProfile.headline ?? null,
    summary: rawProfile.summary ?? null,
    phone: rawProfile.phone ?? null,
    location: rawProfile.location ?? null,
    linkedinUrl: rawProfile.linkedinUrl ?? null,
    githubUrl: rawProfile.githubUrl ?? null,
    portfolioUrl: rawProfile.portfolioUrl ?? null,
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Your professional profile used in all generated resumes.
        </p>
      </div>
      <ProfileForm
        initialProfile={profile}
        userName={session.user?.name ?? ""}
        userEmail={session.user?.email ?? ""}
      />
    </div>
  );
}
