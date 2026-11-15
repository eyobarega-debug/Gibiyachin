import { useState, useEffect } from "react";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import { Button, TextArea } from "../components/ui";
import SocialPostCard from "../components/social/SocialPostCard";
import ImageUploader from "../components/ImageUploader";

export default function Announcements() {
  const { user } = useAuth();
  const toast = useToast();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin announcement composer state
  const [showComposer, setShowComposer] = useState(false);
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user && ["admin", "super_admin"].includes(user.role);

  useEffect(() => {
    let isMounted = true;
    async function loadAnnouncements() {
      setLoading(true);
      try {
        const { data } = await client.get("/announcements");
        if (isMounted) {
          setAnnouncements(data.announcements || []);
        }
      } catch (err) {
        console.error("Failed to load announcements:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAnnouncements();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data } = await client.post("/announcements", {
        content: content.trim(),
        category: "events",
        isPinned,
        mediaUrls: images.length > 0 ? images : undefined,
      });

      setAnnouncements((prev) => [data.post, ...prev]);
      setContent("");
      setIsPinned(false);
      setImages([]);
      setShowComposer(false);
      toast.success("Official university announcement published!");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to publish announcement");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePostUpdated(updated) {
    setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  function handlePostDeleted(deletedId) {
    setAnnouncements((prev) => prev.filter((a) => a.id !== deletedId));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <Icon name="announcement" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              Campus Announcements
            </h1>
            <p className="text-xs text-slate-500">
              Official notices, campus updates, and administrative communications.
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowComposer((prev) => !prev)}
            className="self-start sm:self-auto"
          >
            <Icon name="plus" className="h-4 w-4" />
            <span>{showComposer ? "Close Composer" : "Publish Announcement"}</span>
          </Button>
        )}
      </div>

      {/* Admin Composer */}
      {isAdmin && showComposer && (
        <form
          onSubmit={handleCreateAnnouncement}
          className="mt-6 glass rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900">
            <Icon name="shield" className="h-4 w-4 text-blue-600" />
            <span>New Official Campus Announcement</span>
          </div>

          <TextArea
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type official university announcement or notice..."
            maxLength={5000}
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Attach Images or Official Documents
            </label>
            <ImageUploader value={images} onChange={setImages} max={4} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Pin to top of Announcements & Campus Feed</span>
            </label>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!content.trim() || submitting}
            >
              Publish Now
            </Button>
          </div>
        </form>
      )}

      {/* Announcements List */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass rounded-2xl p-6 border border-slate-200 bg-white/60 animate-pulse h-36"
              />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-slate-200 bg-white/80">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 mb-3">
              <Icon name="announcement" className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No announcements posted</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              There are currently no active official notices for your university campus.
            </p>
          </div>
        ) : (
          announcements.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}
