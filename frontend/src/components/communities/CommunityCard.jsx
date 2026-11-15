import { useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";
import Icon from "../Icon";
import { Button } from "../ui";

export default function CommunityCard({ community, onJoinStatusChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [localCommunity, setLocalCommunity] = useState(community);

  // Sync if prop changes
  if (community && (!localCommunity || localCommunity.id !== community.id)) {
    setLocalCommunity(community);
  }

  if (!localCommunity) return null;

  async function handleJoinToggle(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.info("Please sign in to join communities");
      return;
    }

    setSubmitting(true);
    try {
      if (localCommunity.isMember) {
        // Leave
        if (!window.confirm(`Leave c/${localCommunity.name}?`)) {
          setSubmitting(false);
          return;
        }
        await client.post(`/communities/${localCommunity.id}/leave`);
        const updated = {
          ...localCommunity,
          isMember: false,
          userRole: null,
          membersCount: Math.max(0, (localCommunity.membersCount || 1) - 1),
        };
        setLocalCommunity(updated);
        toast.info(`Left c/${localCommunity.name}`);
        if (onJoinStatusChange) onJoinStatusChange(updated);
      } else {
        // Join or Request
        const { data } = await client.post(`/communities/${localCommunity.id}/join`);
        const updated = {
          ...localCommunity,
          isMember: data.status === "joined",
          hasPendingRequest: data.status === "requested",
          membersCount: data.status === "joined" ? (localCommunity.membersCount || 0) + 1 : localCommunity.membersCount,
        };
        setLocalCommunity(updated);
        toast.success(
          data.status === "requested"
            ? "Join request sent to community moderators"
            : `Joined c/${localCommunity.name}!`
        );
        if (onJoinStatusChange) onJoinStatusChange(updated);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update membership");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-slate-200/80 bg-white/80 p-5 transition hover:shadow-md flex flex-col justify-between">
      <div>
        {/* Header with Avatar and Type Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-base text-slate-800">
              {localCommunity.avatarUrl ? (
                <img src={localCommunity.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                localCommunity.name.slice(0, 2).toUpperCase()
              )}
            </div>

            <div>
              <Link
                to={`/community/communities/${localCommunity.slug || localCommunity.id}`}
                className="font-bold text-sm sm:text-base text-slate-900 hover:underline block"
              >
                c/{localCommunity.name}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 capitalize">
                  {localCommunity.category || "General"}
                </span>
              </div>
            </div>
          </div>

          {/* Type Badge */}
          {localCommunity.type === "official" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-800 border border-blue-200">
              <Icon name="shield" className="h-3 w-3" />
              Official
            </span>
          ) : localCommunity.type === "private" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
              <Icon name="lock" className="h-3 w-3" />
              Private
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
              Public
            </span>
          )}
        </div>

        {/* Description */}
        <p className="mt-3 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
          {localCommunity.description || "Campus student community for sharing, questions, and connecting."}
        </p>
      </div>

      {/* Footer stats & action */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{localCommunity.membersCount || 0} members</span>
          <span>•</span>
          <span>{localCommunity.postsCount || 0} posts</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/community/communities/${localCommunity.slug || localCommunity.id}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            View
          </Link>

          {localCommunity.isMember ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={submitting}
              onClick={handleJoinToggle}
              className="text-xs"
            >
              Joined
            </Button>
          ) : localCommunity.hasPendingRequest ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="text-xs text-amber-700 border-amber-200 bg-amber-50"
            >
              Pending
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleJoinToggle}
              className="text-xs"
            >
              {localCommunity.type === "private" ? "Request" : "Join"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
