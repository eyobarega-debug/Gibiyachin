import { useState, useEffect, useCallback, useRef } from "react";
import { client } from "../api/client";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import DatingNav from "../components/dating/DatingNav";

export default function DatingProfile() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form Fields
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState(18);
  const [gender, setGender] = useState("female");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("2nd Year");
  const [photos, setPhotos] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [interests, setInterests] = useState([]);
  const [favoriteMusic, setFavoriteMusic] = useState([]);
  const [hideMajor, setHideMajor] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/dating/profile");
      if (data?.profile) {
        const p = data.profile;
        setDisplayName(p.displayName || "");
        setAge(p.age || 18);
        setGender(p.gender || "female");
        setBio(p.bio || "");
        setDepartment(p.department || "");
        setAcademicYear(p.academicYear || "2nd Year");
        setPhotos(p.photos || []);
        setAvatarUrl(p.avatarUrl || "");
        setInterests(p.interests || []);
        setFavoriteMusic(p.favoriteMusic || []);
        setHideMajor(Boolean(p.privacySettings?.hideMajor));
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (photos.length + files.length > 6) {
      toast.error("Maximum of 6 photos allowed");
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await client.post("/uploads", formData);
        setPhotos((prev) => [...prev, data.url]);
        if (!avatarUrl) setAvatarUrl(data.url);
      }
      toast.success("Photo uploaded successfully");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        birthDate: "2000-01-01", // Default preserved on update
        adultConfirmed: true,
        displayName: displayName.trim(),
        gender,
        department: department.trim() || null,
        academicYear,
        bio: bio.trim() || "",
        interests,
        favoriteMusic,
        avatarUrl: photos[0] || avatarUrl || null,
        photos,
        privacySettings: { hideMajor },
      };

      await client.put("/dating/profile", payload);
      toast.success("Profile saved successfully");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const INTERESTS_OPTIONS = [
    "Tech & Coding", "AI & Robotics", "Reading", "Music", "Cinema",
    "Football", "Basketball", "Gym & Fitness", "Photography", "Coffee Walks",
    "Art & Design", "Gaming", "Travel", "Cooking", "Volunteering"
  ];

  function toggleInterest(item) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-rose-600" />
        <p className="mt-3 text-xs font-semibold text-slate-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <DatingNav />

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">Edit Connect Profile</h2>
            <p className="text-xs text-slate-500">
              Manage your photos, bio, interests and privacy settings.
            </p>
          </div>
          <span className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
            Age: {age} (Verified 18+)
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Photo Gallery Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">
              Profile Photos (Up to 6)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              multiple
              accept="image/*"
              className="hidden"
            />

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs"
                >
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Primary
                    </span>
                  )}
                </div>
              ))}

              {photos.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-500 hover:text-slate-600 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  ) : (
                    <>
                      <Icon name="plus" className="h-6 w-6" />
                      <span className="mt-1 text-[10px] font-semibold">Add Photo</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
              >
                <option value="female">Woman</option>
                <option value="male">Man</option>
                <option value="non_binary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Department / Major</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Electrical Engineering"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Academic Year</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="5th Year">5th Year</option>
                <option value="Graduate">Graduate</option>
              </select>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">About Me (Bio)</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other students what you enjoy doing..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Interests */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS_OPTIONS.map((item) => {
                const isSelected = interests.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInterest(item)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-rose-500 text-white shadow-xs"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy Toggles */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-xs font-bold text-slate-900 mb-2">Privacy &amp; Visibility</h4>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hideMajor}
                onChange={(e) => setHideMajor(e.target.checked)}
                className="h-4 w-4 rounded-md text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs font-medium text-slate-700">
                Hide my department and major from my public dating card
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-linear-to-r from-rose-500 to-pink-500 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/25 transition hover:from-rose-600 hover:to-pink-600 disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
