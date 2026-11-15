import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import { Button, Input, TextArea, Select } from "../components/ui";
import ImageUploader from "../components/ImageUploader";

export default function CreateCommunity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("general");
  const [type, setType] = useState("public");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [avatarUrls, setAvatarUrls] = useState([]);
  const [bannerUrls, setBannerUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user && ["admin", "super_admin"].includes(user.role);

  function handleNameChange(val) {
    setName(val);
    // Auto-generate clean slug
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generated);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      toast.warn("Please enter a community name");
      return;
    }

    if (!slug.trim()) {
      toast.warn("Please enter a unique URL handle / slug");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        category,
        type,
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        avatarUrl: avatarUrls[0] || undefined,
        bannerUrl: bannerUrls[0] || undefined,
      };

      const { data } = await client.post("/communities", payload);
      toast.success(`Community c/${data.community.name} created successfully!`);
      navigate(`/community/communities/${data.community.slug || data.community.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to create community");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="glass rounded-3xl border border-slate-200 bg-white/95 p-6 sm:p-10 shadow-sm">
        <div className="pb-6 border-b border-slate-200">
          <h1 className="text-2xl font-black text-slate-900">
            Create a Campus Community
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Establish a club, study group, dorm circle, or campus society for your university.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Name & Handle */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Community Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Computer Science Club"
                maxLength={80}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Handle / URL Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 font-medium">
                  c/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="cs-club"
                  className="w-full rounded-r-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                  maxLength={50}
                />
              </div>
            </div>
          </div>

          {/* Category & Privacy Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
              >
                <option value="general">General Campus</option>
                <option value="academic">Academic & Study</option>
                <option value="tech">Tech & Software</option>
                <option value="sports">Sports & Fitness</option>
                <option value="creative">Arts & Creative</option>
                <option value="campus_life">Campus Life & Dorms</option>
                <option value="gaming">Gaming & Esports</option>
                <option value="career">Career & Professional</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Membership Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
              >
                <option value="public">Public (Anyone in campus can join)</option>
                <option value="private">Private (Join requests require approval)</option>
                {isAdmin && (
                  <option value="official">Official (University verified organisation)</option>
                )}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Description
            </label>
            <TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about? Who should join?"
              maxLength={1000}
            />
          </div>

          {/* Community Guidelines */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Community Rules & Guidelines (Optional)
            </label>
            <TextArea
              rows={3}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="List specific rules for discussions and participation..."
              maxLength={2000}
            />
          </div>

          {/* Avatar and Banner */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Community Icon / Logo
              </label>
              <ImageUploader value={avatarUrls} onChange={setAvatarUrls} max={1} />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Community Banner
              </label>
              <ImageUploader value={bannerUrls} onChange={setBannerUrls} max={1} />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              Create Community
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
