"use client";

import { useState, useEffect } from "react";
import type { UserProfileData } from "@/types/career";

interface ProfileFormProps {
  initialProfile: UserProfileData | null;
  userName: string;
  userEmail: string;
}

export default function ProfileForm({ initialProfile, userName, userEmail }: ProfileFormProps) {
  const [profile, setProfile] = useState<UserProfileData | null>(initialProfile);
  const [headline, setHeadline] = useState(initialProfile?.headline ?? "");
  const [summary, setSummary] = useState(initialProfile?.summary ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [location, setLocation] = useState(initialProfile?.location ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile?.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(initialProfile?.githubUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(initialProfile?.portfolioUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialProfile);

  useEffect(() => {
    if (!initialProfile) {
      fetch("/api/career/profile")
        .then((r) => r.json())
        .then((data) => {
          setProfile(data);
          setHeadline(data.headline ?? "");
          setSummary(data.summary ?? "");
          setPhone(data.phone ?? "");
          setLocation(data.location ?? "");
          setLinkedinUrl(data.linkedinUrl ?? "");
          setGithubUrl(data.githubUrl ?? "");
          setPortfolioUrl(data.portfolioUrl ?? "");
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [initialProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/career/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: headline || null,
          summary: summary || null,
          phone: phone || null,
          location: location || null,
          linkedinUrl: linkedinUrl || null,
          githubUrl: githubUrl || null,
          portfolioUrl: portfolioUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="h-10 bg-slate-200 rounded"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="h-10 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            value={userName}
            disabled
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">Managed by your account settings.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">Managed by your account settings.</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Professional Headline</label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Senior Software Engineer · Full-Stack Developer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Professional Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="A brief overview of your professional background, key skills, and career goals..."
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="San Francisco, CA"
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Online Presence</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://linkedin.com/in/yourname"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GitHub URL</label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://github.com/yourname"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio URL</label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://yourportfolio.com"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Profile saved successfully.
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
