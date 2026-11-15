import { useState } from "react";
import { client } from "../../api/client";
import { useToast } from "../Toast";
import Icon from "../Icon";

export default function PollCard({ poll, onPollUpdate }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);

  // Keep synced if parent updates
  if (poll && (!localPoll || localPoll.id !== poll.id)) {
    setLocalPoll(poll);
  }

  if (!localPoll) return null;

  const isExpired = localPoll.isExpired || (localPoll.expiresAt && new Date(localPoll.expiresAt) <= new Date());
  const hasVoted = localPoll.hasVoted || Boolean(localPoll.userVotedOptionId);
  const totalVotes = localPoll.totalVotes || 0;

  async function handleVote(optionId) {
    if (hasVoted || isExpired || submitting) return;

    setSubmitting(true);
    try {
      const { data } = await client.post(`/social/polls/${localPoll.id}/vote`, {
        optionId,
      });

      const updated = data.poll;
      setLocalPoll(updated);
      toast.success("Vote recorded!");
      if (onPollUpdate) onPollUpdate(updated);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  }

  // Format expiry string
  function getExpiryText() {
    if (isExpired) return "Poll closed";
    if (!localPoll.expiresAt) return "Poll active";
    const diff = new Date(localPoll.expiresAt).getTime() - Date.now();
    const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} ${days === 1 ? "day" : "days"} left`;
    }
    return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Icon name="poll" className="h-4 w-4 text-slate-600" />
          <span>Campus Poll</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            isExpired
              ? "bg-slate-200 text-slate-600"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {getExpiryText()}
        </span>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-3">
        {localPoll.question}
      </h4>

      <div className="space-y-2">
        {localPoll.options?.map((opt) => {
          const isSelected = localPoll.userVotedOptionId === opt.id;
          const percentage = opt.percentage !== undefined ? opt.percentage : (totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0);

          if (hasVoted || isExpired) {
            // Results view with progress bar
            return (
              <div
                key={opt.id}
                className={`relative overflow-hidden rounded-xl border p-2.5 transition ${
                  isSelected
                    ? "border-slate-800 bg-white font-medium text-slate-900"
                    : "border-slate-200 bg-white/70 text-slate-700"
                }`}
              >
                {/* Background progress fill */}
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    isSelected ? "bg-slate-200/80" : "bg-slate-100"
                  }`}
                  style={{ width: `${percentage}%` }}
                />

                {/* Option text & percentage overlay */}
                <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm">
                  <span className="flex items-center gap-2">
                    {isSelected && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
                        ✓
                      </span>
                    )}
                    <span className="truncate">{opt.optionText}</span>
                  </span>
                  <span className="ml-2 shrink-0 font-semibold text-slate-900">
                    {percentage}% ({opt.votesCount || 0})
                  </span>
                </div>
              </div>
            );
          }

          // Active voting button
          return (
            <button
              key={opt.id}
              type="button"
              disabled={submitting}
              onClick={() => handleVote(opt.id)}
              className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left text-xs sm:text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="group-hover:text-slate-900">{opt.optionText}</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-transparent transition group-hover:border-slate-800">
                •
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</span>
        {hasVoted && <span className="font-medium text-emerald-700">✓ You voted</span>}
      </div>
    </div>
  );
}
