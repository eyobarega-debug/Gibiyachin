import { useState } from "react";
import { client } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";
import Icon from "../Icon";
import { Button } from "../ui";

export default function CommunityHeader({
  community,
  activeTab,
  onTabChange,
  onCommunityUpdated,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!community) return null;

  const isOwner = community.userRole === "owner";
  const isModerator = community.userRole === "moderator" || isOwner;
  const isAdmin = user && ["admin", "super_admin"].includes(user.role);
  const canManage = isModerator || isAdmin;

  async function handleJoinToggle() {
    if (!user) {
      toast.info("Please sign in to join communities");
      return;
    }

    setSubmitting(true);
    try {
      if (community.isMember) {
        if (!window.confirm(`Leave c/${community.name}?`)) {
          setSubmitting(false);
          return;
        }
        await client.post(`/communities/${community.id}/leave`);
        toast.info(`Left c/${community.name}`);
        if (onCommunityUpdated) {
          onCommunityUpdated({
            ...community,
            isMember: false,
            userRole: null,
            membersCount: Math.max(0, (community.membersCount || 1) - 1),
          });
        }
      } else {
        const { data } = await client.post(`/communities/${community.id}/join`);
        toast.success(
          data.status === "requested"
            ? "Join request sent to moderators"
            : `Joined c/${community.name}!`
        );
        if (onCommunityUpdated) {
          onCommunityUpdated({
            ...community,
            isMember: data.status === "joined",
            hasPendingRequest: data.status === "requested",
            membersCount: data.status === "joined" ? (community.membersCount || 0) + 1 : community.membersCount,
          });
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update membership");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass rounded-3xl border border-slate-200/80 bg-white/90 overflow-hidden shadow-sm mb-6">
      {/* Banner */}
      <div className="relative h-32 sm:h-44 w-full bg-gradient-to-r from-slate-800 to-slate-900 overflow-hidden">
        {community.bannerUrl ? (
          <img
            src={community.bannerUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        )}
      </div>

      {/* Community Info Bar */}
      <div className="px-5 pb-5 pt-0 sm:px-6">
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12">
          {/* Avatar & Title */}
          <div className="flex items-end gap-3.5 sm:gap-4">
            <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md flex items-center justify-center font-bold text-2xl text-slate-800">
              {community.avatarUrl ? (
                <img src={community.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                community.name.slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  c/{community.name}
                </h1>

                {community.type === "official" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
                    <Icon name="shield" className="h-3.5 w-3.5" />
                    Official
                  </span>
                ) : community.type === "private" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                    Public
                  </span>
                )}

                {community.userRole && (
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white capitalize">
                    {community.userRole}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span className="capitalize font-medium text-slate-700">{community.category || "General"}</span>
                <span>•</span>
                <span>{community.membersCount || 0} members</span>
                <span>•</span>
                <span>{community.postsCount || 0} posts</span>
              </div>
            </div>
          </div>

          {/* Join / Leave / Pending Button */}
          <div className="flex items-center gap-2">
            {community.isMember ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                loading={submitting}
                onClick={handleJoinToggle}
              >
                Joined
              </Button>
            ) : community.hasPendingRequest ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled
                className="text-amber-800 border-amber-200 bg-amber-50"
              >
                Request Pending
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={submitting}
                onClick={handleJoinToggle}
              >
                {community.type === "private" ? "Request to Join" : "Join Community"}
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        {community.description && (
          <p className="mt-4 text-sm text-slate-700 leading-relaxed max-w-3xl">
            {community.description}
          </p>
        )}

        {/* Navigation Tabs */}
        <div className="mt-6 flex items-center gap-1 border-t border-slate-100 pt-3 overflow-x-auto text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => onTabChange("discussions")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "discussions"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Discussions
          </button>

          <button
            type="button"
            onClick={() => onTabChange("rules")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "rules"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Community Rules
          </button>

          <button
            type="button"
            onClick={() => onTabChange("members")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "members"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Members ({community.membersCount || 0})
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => onTabChange("requests")}
              className={`px-4 py-2 rounded-xl transition ${
                activeTab === "requests"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Join Requests
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
