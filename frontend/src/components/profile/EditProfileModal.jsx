import { useState, useRef } from "react";
import { Button, ErrorBanner, Input, Modal, TextArea } from "../ui";
import { client, errMsg } from "../../api/client";
import ProfileHeader from "./ProfileHeader";

export default function EditProfileModal({ user, isOpen, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState("form"); // 'form' | 'preview'
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    department: user?.department || "",
    year: user?.year || "",
    bio: user?.bio || "",
    avatarUrl: user?.avatar_url || "",
    coverImageUrl: user?.cover_image_url || "",
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  if (!user) return null;

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar image must be under 5MB");
      return;
    }
    setUploadingAvatar(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await client.post("/uploads", formData);
      setForm((prev) => ({ ...prev, avatarUrl: data.url }));
    } catch (err) {
      setError(errMsg(err, "Failed to upload avatar image"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Cover image must be under 5MB");
      return;
    }
    setUploadingCover(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await client.post("/uploads", formData);
      setForm((prev) => ({ ...prev, coverImageUrl: data.url }));
    } catch (err) {
      setError(errMsg(err, "Failed to upload cover image"));
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError("Full name is required.");
      return;
    }
    setNameError("");
    setSaving(true);
    setError("");
    try {
      await client.patch("/users/me", {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        year: form.year.trim() || null,
        bio: form.bio.trim() || null,
        avatarUrl: form.avatarUrl || null,
        coverImageUrl: form.coverImageUrl || null,
      });
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(errMsg(err, "Failed to save profile changes"));
    } finally {
      setSaving(false);
    }
  }

  // Preview user object merging changes
  const previewUser = {
    ...user,
    name: form.name || user.name,
    phone: form.phone,
    department: form.department,
    year: form.year,
    bio: form.bio,
    avatar_url: form.avatarUrl,
    cover_image_url: form.coverImageUrl,
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit Profile"
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-profile-form" loading={saving} disabled={saving || uploadingAvatar || uploadingCover}>
            {saving ? "Saving Changes…" : "Save Profile"}
          </Button>
        </>
      }
    >
      {/* Tab switcher */}
      <div className="mb-4 inline-flex rounded-lg border border-line bg-canvas p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("form")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "form" ? "glass-soft text-ink shadow-sm" : "text-slate hover:text-ink"
          }`}
        >
          Edit Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "preview" ? "glass-soft text-ink shadow-sm" : "text-slate hover:text-ink"
          }`}
        >
          Live Preview
        </button>
      </div>

      <ErrorBanner message={error} />

      {activeTab === "preview" ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate">
            This is a live preview of how your updated profile header will appear across ግቢያችን:
          </p>
          <ProfileHeader user={previewUser} isOwner={false} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} id="edit-profile-form" className="mt-4 space-y-5">
          {/* Avatar & Cover Uploaders */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Profile Picture / Avatar</label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-line bg-canvas">
                  {form.avatarUrl ? (
                    <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#1c222c] text-lg font-bold text-white">
                      {form.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      loading={uploadingAvatar}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? "Uploading…" : "Upload Photo"}
                    </Button>
                    {form.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, avatarUrl: "" }))}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted">PNG, JPG, WEBP up to 5MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Profile Cover / Wallpaper</label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-24 overflow-hidden rounded-lg border border-line bg-canvas">
                  {form.coverImageUrl ? (
                    <img src={form.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                      Default Cover
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    type="file"
                    ref={coverInputRef}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => coverInputRef.current?.click()}
                      loading={uploadingCover}
                      disabled={uploadingCover}
                    >
                      {uploadingCover ? "Uploading…" : "Upload Cover"}
                    </Button>
                    {form.coverImageUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, coverImageUrl: "" }))}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted">Wide banner, max 5MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              value={form.name}
              error={nameError}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Phone Number"
              type="tel"
              placeholder="+251 9…"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          {/* Academic Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Department / Major"
              placeholder="e.g. Software Engineering"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <Input
              label="Year / Academic Standing"
              placeholder="e.g. 3rd Year / Senior"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </div>

          {/* Bio Field with character counter */}
          <div>
            <TextArea
              label="Bio / About"
              rows={3}
              placeholder="Share a few words about what you study, sell, organize, or your campus interests…"
              value={form.bio}
              onChange={(e) => {
                if (e.target.value.length <= 1000) {
                  setForm({ ...form, bio: e.target.value });
                }
              }}
            />
            <p className="mt-1 text-right text-[11px] text-muted">{form.bio.length} / 1000 characters</p>
          </div>

          {/* University Affiliation (Read-Only) */}
          <div className="rounded-lg border border-line bg-canvas p-3 text-xs text-slate">
            <span className="font-semibold text-ink">University: </span>
            {user.university_name || "ግቢያችን"} ·{" "}
            <span className="italic">
              University affiliation, role, and verification badges cannot be modified directly.
            </span>
          </div>
        </form>
      )}
    </Modal>
  );
}
