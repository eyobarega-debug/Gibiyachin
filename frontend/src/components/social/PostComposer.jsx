import { useState, useEffect } from "react";
import { client } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";
import Icon from "../Icon";
import { Button } from "../ui";
import ImageUploader from "../ImageUploader";
import { getAnonymousPalette } from "../../utils/anonymousAvatar";

export const CONFESSION_CATEGORIES = [
  { value: "Love & Relationships", label: "Love & Relationships ❤️", badgeBg: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "Funny Confessions", label: "Funny Confessions 😂", badgeBg: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "University Life", label: "University Life 🎓", badgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "Heartbreak", label: "Heartbreak 💔", badgeBg: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "Secrets", label: "Secrets 🤫", badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "Rants & Frustrations", label: "Rants & Frustrations 😭", badgeBg: "bg-red-50 text-red-700 border-red-200" },
  { value: "Random Thoughts", label: "Random Thoughts 💭", badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "Hot Takes", label: "Hot Takes 🔥", badgeBg: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "Academic Life", label: "Academic Life 📚", badgeBg: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "Other", label: "Other 💬", badgeBg: "bg-slate-50 text-slate-700 border-slate-200" },
];

export default function PostComposer({ communityId, onPostCreated, onCancel }) {
  const { user } = useAuth();
  const toast = useToast();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Love & Relationships");
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // Poll state (optional interactive confession)
  const [isPollMode, setIsPollMode] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDurationDays, setPollDurationDays] = useState(3);

  // Media upload toggle
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Smart Anonymous Identity for current user
  const [myIdentity, setMyIdentity] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (user) {
      client.get("/social/my-identity")
        .then(({ data }) => {
          if (isMounted && data?.identity) {
            setMyIdentity(data);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-700">
          Sign in to share anonymous confessions, vote, or comment secretly.
        </p>
      </div>
    );
  }

  function handleAddOption() {
    if (pollOptions.length >= 6) {
      toast.warn("Polls can have a maximum of 6 options");
      return;
    }
    setPollOptions([...pollOptions, ""]);
  }

  function handleRemoveOption(index) {
    if (pollOptions.length <= 2) {
      toast.warn("Polls require at least 2 options");
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  }

  function handleOptionChange(index, val) {
    const updated = [...pollOptions];
    updated[index] = val;
    setPollOptions(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() && !isPollMode) {
      toast.warn("Please write your confession before posting");
      return;
    }

    if (isPollMode) {
      if (!pollQuestion.trim() && !content.trim()) {
        toast.warn("Please enter a question for your anonymous poll");
        return;
      }
      const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        toast.warn("Please provide at least 2 poll options");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        content: content.trim() || (isPollMode ? pollQuestion.trim() : ""),
        category,
        images: images.length > 0 ? images : undefined,
        mediaUrls: images.length > 0 ? images : undefined,
        communityId: communityId || undefined,
        audience: communityId ? "community" : "university",
      };

      if (isPollMode) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(pollDurationDays));

        payload.postType = "poll";
        payload.poll = {
          question: (pollQuestion.trim() || content.trim()),
          options: pollOptions.map((o) => o.trim()).filter(Boolean),
          expiresAt: expiresAt.toISOString(),
        };
      }

      const { data } = await client.post("/social/posts", payload);

      toast.success("Confession published anonymously! 🔥");
      setContent("");
      setImages([]);
      setShowImageUpload(false);
      setIsPollMode(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setIsPreview(false);

      if (onPostCreated) {
        onPostCreated(data.post);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to publish confession"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-rose-200/80 bg-white/95 p-4 sm:p-5 shadow-sm backdrop-blur-xs transition">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Anonymity Banner & Category Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {(() => {
              const myPalette = getAnonymousPalette(myIdentity?.identity || "Anonymous #100");
              return (
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-tr ${myPalette.gradient} text-white shadow-xs border ${myPalette.border}`}
                >
                  <Icon name="mask" className="h-5 w-5" />
                </div>
              );
            })()}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  Posting as {myIdentity?.identity || "Anonymous"}
                </span>
                <span className="inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-rose-700">
                  Smart Anonymous ID
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Your thoughts remain consistent under this identity without revealing your real profile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-rose-400 focus:bg-white transition"
            >
              {CONFESSION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Confession Preview Card or Live Textarea */}
        {isPreview ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                  <Icon name="mask" className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900">Anonymous</span>
                  <span className="text-[10px] text-slate-500 block">Just now • Campus Wall</span>
                </div>
              </div>
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-white border-slate-200 text-slate-700">
                {category}
              </span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed pt-1">
              {content || <span className="italic text-slate-400">[No text written yet]</span>}
            </p>
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className="h-28 w-full object-cover rounded-xl border border-slate-200"
                  />
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-500 font-medium pt-1">
              ✨ Preview Mode: Other students will only see "Anonymous" and this content.
            </div>
          </div>
        ) : (
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Spill the tea... share your secret, confession, crush story, or thoughts anonymously..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-sm text-slate-900 outline-none focus:border-rose-400 focus:bg-white resize-y transition placeholder:text-slate-400"
            maxLength={5000}
          />
        )}

        {/* Image Uploader Toggle Area */}
        {showImageUpload && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3.5 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
              <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                <Icon name="camera" className="h-4 w-4 text-slate-600" />
                <span>Attach Images (Max 4)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImageUpload(false);
                  setImages([]);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 text-[11px] text-amber-900 leading-tight">
              <strong>🔒 Privacy Reminder:</strong> Do not upload identifiable student ID cards, badge numbers, or documents with personal names. Metadata is stripped, but photos are publicly visible.
            </div>
            <ImageUploader value={images} onChange={setImages} max={4} />
          </div>
        )}

        {/* Poll Mode Inputs */}
        {isPollMode && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                <Icon name="poll" className="h-4 w-4 text-slate-600" />
                <span>Anonymous Campus Poll</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPollMode(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
              >
                Cancel Poll
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Poll Question <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="e.g. Is it socially acceptable to ask someone out at the campus library?"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-rose-400"
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                Options (2 to 6)
              </label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-400"
                    maxLength={100}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition"
                      aria-label="Remove option"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {pollOptions.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition flex items-center gap-1 pt-1"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" />
                  Add Option
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <span className="text-slate-600 font-medium">Poll Duration:</span>
              <select
                value={pollDurationDays}
                onChange={(e) => setPollDurationDays(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value={1}>24 Hours</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
              </select>
            </div>
          </div>
        )}

        {/* Footer Toolbar & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            {/* Add Photo Button */}
            <button
              type="button"
              onClick={() => setShowImageUpload((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                showImageUpload || images.length > 0
                  ? "bg-rose-100 text-rose-800 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon name="camera" className="h-4 w-4" />
              <span>Photo</span>
              {images.length > 0 && <span className="font-bold">({images.length})</span>}
            </button>

            {/* Poll Button */}
            <button
              type="button"
              onClick={() => setIsPollMode((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                isPollMode ? "bg-rose-100 text-rose-800 font-semibold" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon name="poll" className="h-4 w-4" />
              <span>Poll</span>
            </button>

            {/* Preview Button */}
            {content.trim() && (
              <button
                type="button"
                onClick={() => setIsPreview((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                  isPreview ? "bg-purple-100 text-purple-800 font-semibold" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{isPreview ? "Exit Preview" : "Preview"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(content.trim() || images.length > 0 || onCancel) && (
              <button
                type="button"
                onClick={() => {
                  setContent("");
                  setImages([]);
                  setIsPreview(false);
                  setIsPollMode(false);
                  setShowImageUpload(false);
                  if (onCancel) onCancel();
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
              >
                Clear
              </button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={submitting || (!content.trim() && !isPollMode && images.length === 0)}
              className="bg-linear-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700 border-none shadow-xs"
            >
              Publish Confession 🔥
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
