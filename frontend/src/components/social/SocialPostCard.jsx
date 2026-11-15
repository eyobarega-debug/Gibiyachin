import { useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";
import Icon from "../Icon";
import { Button } from "../ui";
import PollCard from "./PollCard";
import CommentSection from "./CommentSection";
import ReportModal from "./ReportModal";
import { CONFESSION_CATEGORIES } from "./PostComposer";
import { getAnonymousPalette, formatLikesSentence } from "../../utils/anonymousAvatar";

function timeAgo(dateString) {
  if (!dateString) return "";
  const sec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  return new Date(dateString).toLocaleDateString();
}

function getCategoryBadge(catName) {
  const match = CONFESSION_CATEGORIES.find(
    (c) => c.value.toLowerCase() === (catName || "").toLowerCase()
  );
  if (match) return match;
  return {
    value: catName || "Confession",
    label: catName || "Confession",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
  };
}

export default function SocialPostCard({ post, onPostUpdated, onPostDeleted }) {
  const { user } = useAuth();
  const toast = useToast();

  const [localPost, setLocalPost] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Likes viewer modal state
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  // Moderator Identity Audit Modal state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditReason, setAuditReason] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [disclosedData, setDisclosedData] = useState(null);

  // Edit post state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editCategory, setEditCategory] = useState(post.category || "Love & Relationships");
  const [savingEdit, setSavingEdit] = useState(false);

  // Sync if parent updates
  if (post && (!localPost || localPost.id !== post.id)) {
    setLocalPost(post);
  }

  if (!localPost) return null;

  // Strict anonymity: isAuthor is delivered securely by backend without exposing authorId
  const isAuthor = Boolean(localPost.isAuthor);
  const isAdmin = user && ["admin", "super_admin"].includes(user.role);

  async function handleToggleLike() {
    if (!user) {
      toast.info("Please sign in to like confessions");
      return;
    }

    try {
      const { data } = await client.post(`/social/posts/${localPost.id}/like`);
      const updated = {
        ...localPost,
        isLiked: data.liked,
        likesCount: data.likesCount,
      };
      setLocalPost(updated);
      if (onPostUpdated) onPostUpdated(updated);
    } catch (err) {
      toast.error("Failed to update like");
    }
  }

  async function openLikesModal() {
    setShowLikesModal(true);
    setLoadingLikes(true);
    try {
      const { data } = await client.get(`/social/posts/${localPost.id}/likes`);
      setLikesList(data.likes || []);
    } catch (err) {
      setLikesList((localPost.recentLikes || []).map((id) => ({ identity: id })));
    } finally {
      setLoadingLikes(false);
    }
  }

  async function handleToggleBookmark() {
    if (!user) {
      toast.info("Please sign in to save confessions");
      return;
    }

    try {
      const { data } = await client.post(`/social/posts/${localPost.id}/bookmark`);
      const updated = {
        ...localPost,
        isBookmarked: data.bookmarked,
        bookmarksCount: data.bookmarksCount,
      };
      setLocalPost(updated);
      if (onPostUpdated) onPostUpdated(updated);
      toast.success(data.bookmarked ? "Confession saved" : "Confession removed from saved");
    } catch (err) {
      toast.error("Failed to update bookmark");
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editContent.trim()) return;

    setSavingEdit(true);
    try {
      const { data } = await client.patch(`/social/posts/${localPost.id}`, {
        content: editContent.trim(),
        category: editCategory,
      });

      setLocalPost(data.post);
      setIsEditing(false);
      toast.success("Confession updated");
      if (onPostUpdated) onPostUpdated(data.post);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update confession");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeletePost() {
    if (!window.confirm("Are you sure you want to delete this confession?")) return;

    try {
      await client.delete(`/social/posts/${localPost.id}`);
      toast.success("Confession deleted");
      if (onPostDeleted) onPostDeleted(localPost.id);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to delete confession");
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/confessions?post=${localPost.id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast.success("Confession link copied to clipboard! 🔥");
    }
    client.post(`/social/posts/${localPost.id}/share`).catch(() => {});
  }

  async function handleDiscloseIdentity(e) {
    e.preventDefault();
    if (!auditReason.trim() || auditReason.trim().length < 10) {
      toast.warn("A detailed reason of at least 10 characters is required for identity investigation.");
      return;
    }

    setAuditing(true);
    try {
      const { data } = await client.post("/social/moderation/disclose-identity", {
        targetType: "post",
        targetId: localPost.id,
        reason: auditReason.trim(),
      });
      setDisclosedData(data.disclosedUser);
      toast.success("Audit logged: Identity disclosed for authorized moderation.");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Identity investigation rejected");
    } finally {
      setAuditing(false);
    }
  }

  const images = localPost.mediaUrls || localPost.images || [];
  const catBadge = getCategoryBadge(localPost.category);
  const authorPalette = getAnonymousPalette(localPost.authorName);

  return (
    <article className="rounded-3xl border border-rose-100/80 bg-white/95 p-4 sm:p-5 transition hover:shadow-md hover:border-rose-200/90 shadow-2xs backdrop-blur-xs">
      {/* Pinned announcement banner */}
      {localPost.isPinned && (
        <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50/90 border border-amber-200/70 rounded-2xl px-3 py-1">
          <Icon name="pin" className="h-3.5 w-3.5 text-amber-600" />
          <span>Pinned Campus Announcement</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Smart Anonymous Avatar */}
          {localPost.isOfficial ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs">
              <Icon name="shield" className="h-5 w-5" />
            </div>
          ) : (
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-tr ${authorPalette.gradient} text-white shadow-2xs border ${authorPalette.border}`}
            >
              <Icon name="mask" className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                {localPost.isOfficial ? "Campus Administration" : (localPost.authorName || "Anonymous")}
              </span>

              {/* Private owner badge */}
              {isAuthor && (
                <span
                  title="Only you can see this label on your device"
                  className="rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 text-[10px] font-bold px-2 py-0.2"
                >
                  Your Confession
                </span>
              )}

              {/* Official verified badge */}
              {localPost.isOfficial && (
                <span
                  title="Official Campus Announcement"
                  className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200"
                >
                  <Icon name="shield" className="h-3 w-3" />
                  Official
                </span>
              )}
            </div>

            {/* Context line: Category / Timestamp */}
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-bold ${catBadge.badgeBg}`}
              >
                {catBadge.label}
              </span>
              <span>•</span>
              <span className="text-[11px] font-medium text-slate-400">
                {timeAgo(localPost.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Post Options Menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Confession options"
          >
            <Icon name="dots" className="h-5 w-5" />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-8 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fade-in text-xs"
              onMouseLeave={() => setShowMenu(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  handleShare();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50 font-medium"
              >
                <Icon name="share" className="h-3.5 w-3.5 text-slate-500" />
                Copy Secret Link
              </button>

              {isAuthor && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setIsEditing(true);
                      setEditContent(localPost.content);
                      setEditCategory(localPost.category || "Love & Relationships");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    <Icon name="edit" className="h-3.5 w-3.5 text-slate-500" />
                    Edit Confession
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      handleDeletePost();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 font-medium"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5 text-red-500" />
                    Delete Confession
                  </button>
                </>
              )}

              {isAdmin && !isAuthor && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      handleDeletePost();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 font-medium"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5 text-red-500" />
                    Moderate: Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setDisclosedData(null);
                      setAuditReason("");
                      setShowAuditModal(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-amber-700 hover:bg-amber-50 font-medium border-t border-slate-100 mt-1"
                  >
                    <Icon name="shield" className="h-3.5 w-3.5 text-amber-600" />
                    Investigate Identity (Audit)
                  </button>
                </>
              )}

              {!isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setShowReport(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 font-medium"
                >
                  <Icon name="ban" className="h-3.5 w-3.5 text-red-500" />
                  Report Abuse
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Body */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="mt-3.5 space-y-3">
          <textarea
            rows={4}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-rose-400"
            required
            maxLength={5000}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
            >
              {CONFESSION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingEdit}
                className="bg-rose-600 text-white hover:bg-rose-700 border-none"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mt-3.5">
          <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words font-normal">
            {localPost.content}
          </p>

          {/* Media Images */}
          {images.length > 0 && (
            <div
              className={`mt-3.5 grid gap-2 overflow-hidden rounded-2xl border border-slate-200/80 ${
                images.length === 1
                  ? "grid-cols-1"
                  : images.length === 2
                  ? "grid-cols-2"
                  : images.length === 3
                  ? "grid-cols-3"
                  : "grid-cols-2"
              }`}
            >
              {images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedImage(imgUrl)}
                  className="relative group cursor-pointer overflow-hidden bg-slate-100 max-h-80"
                >
                  <img
                    src={imgUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Interactive Poll */}
          {localPost.poll && (
            <PollCard
              poll={localPost.poll}
              onPollUpdate={(updatedPoll) => {
                setLocalPost((prev) => ({ ...prev, poll: updatedPoll }));
              }}
            />
          )}
        </div>
      )}

      {/* Smart Anonymous Likes Summary */}
      {localPost.likesCount > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <Icon name="heart" className="h-3 w-3 fill-rose-500 text-rose-500" />
          </span>
          <button
            type="button"
            onClick={openLikesModal}
            className="font-medium text-slate-600 hover:text-slate-900 transition hover:underline text-left cursor-pointer"
          >
            {formatLikesSentence(localPost.recentLikes, localPost.likesCount)}
          </button>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Like */}
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 font-bold transition hover:bg-rose-50/80 ${
              localPost.isLiked ? "text-rose-600 bg-rose-50" : "text-slate-600 hover:text-rose-600"
            }`}
          >
            <Icon
              name="heart"
              className={`h-4 w-4 ${localPost.isLiked ? "fill-rose-600 text-rose-600" : ""}`}
            />
            <span>{localPost.likesCount || 0}</span>
            <span className="hidden sm:inline">React</span>
          </button>

          {/* Comments */}
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 font-semibold transition hover:bg-slate-100 ${
              showComments ? "bg-slate-100 text-slate-900" : "text-slate-600"
            }`}
          >
            <Icon name="comment" className="h-4 w-4" />
            <span>{localPost.commentsCount || 0}</span>
            <span className="hidden sm:inline">Comments</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 font-semibold transition hover:bg-slate-100 text-slate-600"
          >
            <Icon name="share" className="h-4 w-4" />
            <span>{localPost.sharesCount || 0}</span>
          </button>
        </div>

        {/* Bookmark */}
        <button
          type="button"
          onClick={handleToggleBookmark}
          title={localPost.isBookmarked ? "Saved" : "Save Confession"}
          className={`p-2 rounded-2xl transition hover:bg-slate-100 ${
            localPost.isBookmarked ? "text-slate-900 bg-slate-100" : "text-slate-400"
          }`}
        >
          <Icon
            name="bookmark"
            className={`h-4 w-4 ${localPost.isBookmarked ? "fill-current" : ""}`}
          />
        </button>
      </div>

      {/* Expanded Comments Section */}
      {showComments && (
        <CommentSection
          postId={localPost.id}
          onCommentCountChange={(diff) => {
            setLocalPost((prev) => ({
              ...prev,
              commentsCount: Math.max(0, (prev.commentsCount || 0) + diff),
            }));
          }}
        />
      )}

      {/* Safety Report Modal */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="post"
        targetId={localPost.id}
      />

      {/* Moderator Identity Disclosure Modal */}
      {showAuditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowAuditModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Icon name="shield" className="h-4 w-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Moderator Identity Investigation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            {disclosedData ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                  ✅ Author identity verified for abuse investigation. This access was logged in the permanent audit trail.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                  <div>
                    <span className="text-slate-500 font-medium">Full Name:</span>{" "}
                    <strong className="text-slate-900">{disclosedData.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Campus Email:</span>{" "}
                    <strong className="text-slate-900">{disclosedData.email}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Department:</span>{" "}
                    <span className="text-slate-800">{disclosedData.department || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Account Role:</span>{" "}
                    <span className="capitalize text-slate-800">{disclosedData.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Status:</span>{" "}
                    <span className={disclosedData.suspended ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                      {disclosedData.suspended ? "Suspended" : "Active"}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAuditModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDiscloseIdentity} className="mt-4 space-y-3 text-xs">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900 leading-relaxed">
                  <strong>⚠️ Legal &amp; Audit Notice:</strong> Accessing anonymous confession author identities is restricted to severe safety violations (threats, doxxing, harassment). Your access is permanently audited.
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Investigation Reason <span className="text-red-500">* (min 10 chars)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    placeholder="e.g. Investigation of reported threats against student safety under Case #102..."
                    className="w-full rounded-2xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-amber-500"
                    required
                    minLength={10}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAuditModal(false)}
                    disabled={auditing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={auditing}
                    disabled={auditing || auditReason.trim().length < 10}
                    className="bg-amber-600 text-white hover:bg-amber-700 border-none"
                  >
                    Disclose &amp; Audit Identity
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl">
            <img src={selectedImage} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/90"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Smart Anonymous Likes Modal */}
      {showLikesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowLikesModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                  <Icon name="heart" className="h-4 w-4 fill-rose-500 text-rose-500" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Reactions ({localPost.likesCount || likesList.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLikesModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {loadingLikes ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading reactions...</div>
              ) : likesList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">No reactions yet.</div>
              ) : (
                likesList.map((liker, idx) => {
                  const p = getAnonymousPalette(liker.identity);
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2.5 rounded-2xl bg-slate-50/80 p-2 border border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-tr ${p.gradient} text-white shadow-2xs`}>
                          <Icon name="mask" className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">{liker.identity}</span>
                      </div>
                      {liker.createdAt && (
                        <span className="text-[10px] text-slate-400">{timeAgo(liker.createdAt)}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-center text-[10px] text-slate-400">
              🔒 All reactions are completely anonymous to fellow students.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
