import { useState } from "react";
import Icon from "../Icon";

export function BlockModal({ targetUser, isOpen, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !targetUser) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(targetUser.id, reason);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-rise">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-200">
          <Icon name="ban" className="h-6 w-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900">Block {targetUser.name}?</h3>
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
          Blocking this user will prevent them from sending you messages or seeing your profile in Gibiyachin Connect. They will not be notified that they were blocked.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for blocking (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Unwanted messages or spam"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-hidden"
          />

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? "Blocking..." : "Block User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReportModal({ targetUser, conversationId, isOpen, onClose, onConfirm }) {
  const [reason, setReason] = useState("Harassment or bullying");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !targetUser) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm({
        targetUserId: targetUser.id,
        conversationId,
        reason,
        details,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const reasons = [
    "Harassment or bullying",
    "Spam or scam attempt",
    "Inappropriate content or photos",
    "Impersonation or fake account",
    "Underage user",
    "Other violation",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-rise">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <Icon name="alert" className="h-6 w-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900">Report User</h3>
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
          Our campus moderation team investigates every report. All reports remain confidential.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Violation Category
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-hidden"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Details (optional)
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
