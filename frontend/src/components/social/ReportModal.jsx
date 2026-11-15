import { useState } from "react";
import { client } from "../../api/client";
import { useToast } from "../Toast";
import Icon from "../Icon";
import { Button } from "../ui";

const REASONS = [
  { value: "harassment", label: "Harassment or Bullying" },
  { value: "hate_speech", label: "Hate Speech or Discrimination" },
  { value: "spam", label: "Spam or Commercial Promotion" },
  { value: "inappropriate_content", label: "Inappropriate or Offensive Content" },
  { value: "misinformation", label: "False Information" },
  { value: "impersonation", label: "Impersonation or Fake Account" },
  { value: "other", label: "Other Concern" },
];

export default function ReportModal({ isOpen, onClose, targetType = "post", targetId, onSuccess }) {
  const toast = useToast();
  const [reasonCategory, setReasonCategory] = useState("harassment");
  const [reasonDetails, setReasonDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!targetId) return;

    setSubmitting(true);
    try {
      const endpoint =
        targetType === "comment"
          ? `/social/comments/${targetId}/report`
          : `/social/posts/${targetId}/report`;

      await client.post(endpoint, {
        reasonCategory,
        reasonDetails: reasonDetails.trim() || undefined,
      });

      toast.success("Thank you for your report. Our campus moderation team will review it.");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-red-50 text-red-600">
              <Icon name="ban" className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Report {targetType === "comment" ? "Comment" : "Post"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Reason for reporting
            </label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm cursor-pointer transition ${
                    reasonCategory === r.value
                      ? "border-slate-800 bg-slate-50 font-medium text-slate-900"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="reasonCategory"
                    value={r.value}
                    checked={reasonCategory === r.value}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    className="accent-slate-900"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Additional Details (Optional)
            </label>
            <textarea
              rows={3}
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="Provide any additional context for campus moderators..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              loading={submitting}
            >
              Submit Report
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
