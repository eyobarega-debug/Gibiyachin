import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import DatingNav from "../components/dating/DatingNav";

export default function DatingSettings() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState("active");

  // Preferences
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(28);
  const [interestedIn, setInterestedIn] = useState("everyone");
  const [sameUniversityOnly, setSameUniversityOnly] = useState(true);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/dating/profile");
      if (data?.preferences) {
        setMinAge(data.preferences.minAge || 18);
        setMaxAge(data.preferences.maxAge || 30);
        setInterestedIn(data.preferences.interestedIn || "everyone");
        setSameUniversityOnly(data.preferences.sameUniversityOnly !== false);
      }
      if (data?.profile) {
        setProfileStatus(data.profile.status);
      }
    } catch (err) {
      console.error("Failed to load preferences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  async function handleSavePreferences(e) {
    e.preventDefault();
    if (minAge < 18) {
      toast.error("Minimum age must be at least 18");
      return;
    }
    if (maxAge < minAge) {
      toast.error("Maximum age must be greater than or equal to minimum age");
      return;
    }

    setSaving(true);
    try {
      await client.put("/dating/preferences", {
        minAge,
        maxAge,
        interestedIn,
        sameUniversityOnly,
      });
      toast.success("Discovery preferences updated");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update preferences");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(newStatus) {
    try {
      await client.patch("/dating/profile/status", { status: newStatus });
      setProfileStatus(newStatus);
      toast.success(
        newStatus === "paused"
          ? "Profile paused: you will not appear in discovery"
          : "Profile activated"
      );
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update status");
    }
  }

  async function handleDeleteProfile() {
    if (!confirm("Are you sure you want to delete your Gibiyachin Connect profile? All matches and discovery data will be deactivated.")) {
      return;
    }
    try {
      await client.patch("/dating/profile/status", { status: "deleted" });
      toast.success("Dating profile deleted");
      navigate("/dating");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to delete profile");
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-rose-600" />
        <p className="mt-3 text-xs font-semibold text-slate-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <DatingNav />

      <div className="space-y-6">
        {/* Discovery Filter Preferences */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-6">
            <h2 className="text-lg font-bold text-slate-900">Discovery Preferences</h2>
            <p className="text-xs text-slate-500">
              Customize candidate age ranges and matching criteria.
            </p>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-5">
            {/* Age Range */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-900">
                  Age Range (18+)
                </label>
                <span className="text-xs font-bold text-rose-600">
                  Between {minAge} and {maxAge}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] text-slate-400 mb-1">Minimum Age</span>
                  <input
                    type="number"
                    min={18}
                    max={maxAge}
                    value={minAge}
                    onChange={(e) => setMinAge(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 mb-1">Maximum Age</span>
                  <input
                    type="number"
                    min={minAge}
                    max={60}
                    value={maxAge}
                    onChange={(e) => setMaxAge(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Interested In */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-2">
                Interested In
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: "everyone", label: "Everyone" },
                  { key: "women", label: "Women" },
                  { key: "men", label: "Men" },
                  { key: "other", label: "Non-binary / Other" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setInterestedIn(item.key)}
                    className={`rounded-xl py-2 px-3 text-xs font-semibold transition ${
                      interestedIn === item.key
                        ? "bg-slate-900 text-white shadow-xs"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Same Campus Only */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameUniversityOnly}
                  onChange={(e) => setSameUniversityOnly(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-md text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Campus Isolation (Same University Only)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                    Only discover and match with students who attend your campus.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </form>
        </div>

        {/* Profile Status & Safety Controls */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-6">
            <h2 className="text-lg font-bold text-slate-900">Account &amp; Visibility Controls</h2>
            <p className="text-xs text-slate-500">
              Pause or permanently remove your dating profile at any time.
            </p>
          </div>

          <div className="space-y-4">
            {/* Pause Account */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {profileStatus === "paused" ? "Profile is Paused" : "Pause Connect Profile"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Temporarily hides your profile from discovery. Existing matches and chats remain accessible.
                </p>
              </div>

              {profileStatus === "paused" ? (
                <button
                  type="button"
                  onClick={() => handleToggleStatus("active")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  Resume Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleStatus("paused")}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition"
                >
                  Pause
                </button>
              )}
            </div>

            {/* Delete Account */}
            <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
              <div>
                <p className="text-xs font-bold text-rose-900">Delete Dating Profile</p>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  Deactivates your Gibiyachin Connect profile. Your main campus marketplace account is untouched.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDeleteProfile}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
