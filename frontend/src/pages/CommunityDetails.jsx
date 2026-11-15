import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import { Button } from "../components/ui";
import CommunityHeader from "../components/communities/CommunityHeader";
import PostComposer from "../components/social/PostComposer";
import SocialPostCard from "../components/social/SocialPostCard";

export default function CommunityDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("discussions");

  // Discussions state
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Members state
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Requests state
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchCommunity = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/communities/${id}`);
      setCommunity(data.community);
    } catch (err) {
      console.error("Failed to load community:", err);
      toast.error(err?.response?.data?.error?.message || "Community not found");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchCommunityPosts = useCallback(async (communityId) => {
    setLoadingPosts(true);
    try {
      const { data } = await client.get("/social/feed", {
        params: { communityId, limit: 20 },
      });
      setPosts(data.posts || []);
    } catch (err) {
      console.error("Failed to load community posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const fetchMembers = useCallback(async (communityId) => {
    setLoadingMembers(true);
    try {
      const { data } = await client.get(`/communities/${communityId}/members`);
      setMembers(data.members || []);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchRequests = useCallback(async (communityId) => {
    setLoadingRequests(true);
    try {
      const { data } = await client.get(`/communities/${communityId}/join-requests`);
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Failed to load join requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  useEffect(() => {
    if (!community) return;

    if (activeTab === "discussions") {
      fetchCommunityPosts(community.id);
    } else if (activeTab === "members") {
      fetchMembers(community.id);
    } else if (activeTab === "requests") {
      fetchRequests(community.id);
    }
  }, [community, activeTab, fetchCommunityPosts, fetchMembers, fetchRequests]);

  async function handleApproveRequest(requestId) {
    try {
      await client.post(`/communities/${community.id}/join-requests/${requestId}/approve`);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setCommunity((prev) => ({
        ...prev,
        membersCount: (prev.membersCount || 0) + 1,
      }));
      toast.success("Join request approved");
    } catch (err) {
      toast.error("Failed to approve request");
    }
  }

  async function handleRejectRequest(requestId) {
    try {
      await client.post(`/communities/${community.id}/join-requests/${requestId}/reject`);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.info("Join request rejected");
    } catch (err) {
      toast.error("Failed to reject request");
    }
  }

  async function handleUpdateMemberRole(memberUserId, newRole) {
    try {
      await client.patch(`/communities/${community.id}/members/${memberUserId}`, {
        role: newRole,
      });
      setMembers((prev) =>
        prev.map((m) => (m.userId === memberUserId ? { ...m, role: newRole } : m))
      );
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update role");
    }
  }

  async function handleRemoveMember(memberUserId) {
    if (!window.confirm("Are you sure you want to remove this member from the community?")) return;

    try {
      await client.delete(`/communities/${community.id}/members/${memberUserId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
      setCommunity((prev) => ({
        ...prev,
        membersCount: Math.max(0, (prev.membersCount || 1) - 1),
      }));
      toast.success("Member removed");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to remove member");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-slate-500">
        Loading community...
      </div>
    );
  }

  if (!community) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800">Community Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          The requested campus community does not exist or has been removed.
        </p>
        <Link
          to="/community/explore"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Explore Other Communities
        </Link>
      </div>
    );
  }

  // Private gate: if community is private and user is not a member
  const isPrivateLocked = community.type === "private" && !community.isMember && user?.role !== "admin" && user?.role !== "super_admin";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <CommunityHeader
        community={community}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCommunityUpdated={setCommunity}
      />

      {/* If Private and Not a Member */}
      {isPrivateLocked ? (
        <div className="glass rounded-3xl border border-amber-200 bg-amber-50/70 p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800 mb-4">
            <Icon name="lock" className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            This is a Private Campus Community
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
            Discussions, resources, and members of c/{community.name} are private to verified members.
            Request to join to participate in conversations.
          </p>

          <div className="mt-6 flex justify-center">
            {community.hasPendingRequest ? (
              <span className="rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-800 shadow-sm">
                Join Request Pending Review
              </span>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  try {
                    const { data } = await client.post(`/communities/${community.id}/join`);
                    setCommunity((prev) => ({
                      ...prev,
                      hasPendingRequest: data.status === "requested",
                      isMember: data.status === "joined",
                    }));
                    toast.success("Join request submitted!");
                  } catch (err) {
                    toast.error(err?.response?.data?.error?.message || "Failed to submit request");
                  }
                }}
              >
                Request to Join Community
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* TAB 1: DISCUSSIONS */}
          {activeTab === "discussions" && (
            <div className="space-y-4">
              {/* Scoped Composer */}
              {community.isMember && (
                <PostComposer
                  communityId={community.id}
                  onPostCreated={(newPost) => setPosts((prev) => [newPost, ...prev])}
                />
              )}

              {/* Feed of Posts */}
              {loadingPosts ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="glass rounded-2xl p-6 border border-slate-200/80 bg-white/60 animate-pulse h-36" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center border border-slate-200 bg-white/70">
                  <p className="text-sm text-slate-500">
                    No discussions in c/{community.name} yet. Start the conversation!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <SocialPostCard
                      key={post.id}
                      post={post}
                      onPostUpdated={(up) => setPosts((prev) => prev.map((p) => (p.id === up.id ? up : p)))}
                      onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RULES */}
          {activeTab === "rules" && (
            <div className="glass rounded-2xl border border-slate-200 bg-white/90 p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Community Guidelines & Rules
              </h3>

              {community.rules ? (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {community.rules}
                </p>
              ) : (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>1. <strong>Be respectful and constructive:</strong> Treat fellow students and faculty with courtesy.</p>
                  <p>2. <strong>No harassment or hate speech:</strong> Discrimination, harassment, or abusive remarks are strictly prohibited.</p>
                  <p>3. <strong>Stay on topic:</strong> Keep posts and questions relevant to the purpose of this community.</p>
                  <p>4. <strong>Respect academic integrity:</strong> Do not share exam answers or violate university honor codes.</p>
                  <p>5. <strong>Follow Gibiyachin Campus Safety:</strong> Adhere to campus regulations and community safety standards.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === "members" && (
            <div className="glass rounded-2xl border border-slate-200 bg-white/90 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Community Members ({members.length})
              </h3>

              {loadingMembers ? (
                <div className="text-center py-6 text-sm text-slate-400">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">No members found.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const isOwner = community.userRole === "owner";
                    const canEditThisMember = isOwner && m.role !== "owner";

                    return (
                      <div key={m.userId} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              (m.fullName || "S")[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="block text-sm font-semibold text-slate-900">
                              {m.fullName}
                            </span>
                            {m.department && (
                              <span className="block text-xs text-slate-500">
                                {m.department}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canEditThisMember ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateMemberRole(m.userId, e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold capitalize text-slate-800"
                            >
                              <option value="member">Member</option>
                              <option value="moderator">Moderator</option>
                            </select>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
                              {m.role}
                            </span>
                          )}

                          {canEditThisMember && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.userId)}
                              className="p-1 text-slate-400 hover:text-red-600 transition"
                              title="Remove member"
                            >
                              <Icon name="close" className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: JOIN REQUESTS */}
          {activeTab === "requests" && (
            <div className="glass rounded-2xl border border-slate-200 bg-white/90 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Pending Join Requests ({requests.length})
              </h3>

              {loadingRequests ? (
                <div className="text-center py-6 text-sm text-slate-400">Loading requests...</div>
              ) : requests.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  No pending join requests.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                          {req.avatarUrl ? (
                            <img src={req.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (req.fullName || "S")[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-slate-900">
                            {req.fullName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            Requested {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectRequest(req.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApproveRequest(req.id)}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
