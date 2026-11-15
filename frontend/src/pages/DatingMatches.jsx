import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import DatingNav from "../components/dating/DatingNav";

export default function DatingMatches() {
  const navigate = useNavigate();
  const toast = useToast();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unmatchingId, setUnmatchingId] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/dating/matches");
      setMatches(data || []);
    } catch (err) {
      console.error("Failed to load matches:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  async function handleUnmatch(matchId) {
    if (!confirm("Are you sure you want to unmatch? This will end the conversation.")) return;
    setUnmatchingId(matchId);
    try {
      await client.post(`/dating/matches/${matchId}/unmatch`);
      toast.success("Unmatched successfully");
      setMatches((prev) => prev.filter((m) => m.matchId !== matchId));
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to unmatch");
    } finally {
      setUnmatchingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <DatingNav activeMatchesCount={matches.length} />

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Your Matches</h2>
        <p className="text-xs text-slate-500 mb-6">
          Mutual likes with students across your campus. Tap to start chatting!
        </p>

        {loading ? (
          <div className="py-24 text-center">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-rose-600" />
            <p className="mt-3 text-xs font-semibold text-slate-500">Loading matches...</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 mb-3">
              <Icon name="heart" className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Matches Yet</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              Swipe right on profiles you're interested in. When they like you back, they'll appear right here!
            </p>
            <div className="mt-5">
              <Link
                to="/dating"
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
              >
                Start Discovering
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {matches.map((m) => {
              const p = m.partner;
              return (
                <div
                  key={m.matchId}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-md transition hover:shadow-lg flex flex-col"
                >
                  {/* Photo Banner - clickable to view profile */}
                  <div
                    onClick={() => setSelectedMatch(m)}
                    className="relative h-48 w-full bg-slate-900 overflow-hidden cursor-pointer"
                    title="Click to view full profile"
                  >
                    {p.avatarUrl || (p.photos && p.photos[0]) ? (
                      <img
                        src={p.avatarUrl || p.photos[0]}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-500">
                        <Icon name="user" className="h-12 w-12 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3 text-white">
                      <p className="truncate text-base font-bold">
                        {p.displayName}, {p.age}
                      </p>
                      <p className="truncate text-[10px] text-slate-200">
                        {p.department || p.universityName || "Campus Student"}
                      </p>
                    </div>
                  </div>

                  {/* Card Content & Bio */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div onClick={() => setSelectedMatch(m)} className="cursor-pointer">
                      {p.bio && (
                        <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                          {p.bio}
                        </p>
                      )}
                      {p.interests && p.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {p.interests.slice(0, 3).map((int, i) => (
                            <span
                              key={i}
                              className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              {int}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/messages/${m.conversationId}`)}
                        className="flex-1 rounded-xl bg-linear-to-r from-rose-500 to-pink-500 py-2 text-xs font-bold text-white shadow-xs transition hover:from-rose-600 hover:to-pink-600 flex items-center justify-center gap-1.5"
                      >
                        <Icon name="messages" className="h-4 w-4" />
                        <span>Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUnmatch(m.matchId)}
                        disabled={unmatchingId === m.matchId}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition"
                        title="Unmatch"
                      >
                        <Icon name="close" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Matched Profile Full View Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-rise">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedMatch(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>

            {/* Profile Photos */}
            <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-slate-900 mb-4">
              {selectedMatch.partner.photos && selectedMatch.partner.photos.length > 0 ? (
                <img
                  src={selectedMatch.partner.photos[0]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : selectedMatch.partner.avatarUrl ? (
                <img
                  src={selectedMatch.partner.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-500">
                  <Icon name="user" className="h-16 w-16" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <h3 className="text-xl font-bold">
                  {selectedMatch.partner.displayName}, {selectedMatch.partner.age}
                </h3>
                <p className="text-xs text-slate-200">
                  {selectedMatch.partner.department || selectedMatch.partner.universityName || "Campus Student"}
                  {selectedMatch.partner.academicYear ? ` • ${selectedMatch.partner.academicYear}` : ""}
                </p>
              </div>
            </div>

            {/* Bio */}
            {selectedMatch.partner.bio && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">About</p>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedMatch.partner.bio}
                </p>
              </div>
            )}

            {/* Interests */}
            {selectedMatch.partner.interests && selectedMatch.partner.interests.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMatch.partner.interests.map((int, i) => (
                    <span
                      key={i}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Favorite Music */}
            {selectedMatch.partner.favoriteMusic && selectedMatch.partner.favoriteMusic.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Favorite Music</p>
                <p className="text-xs text-slate-600">
                  {selectedMatch.partner.favoriteMusic.join(", ")}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const convId = selectedMatch.conversationId;
                  setSelectedMatch(null);
                  navigate(`/messages/${convId}`);
                }}
                className="flex-1 rounded-2xl bg-linear-to-r from-rose-500 to-pink-500 py-3 text-xs font-bold text-white shadow-md transition hover:from-rose-600 hover:to-pink-600 flex items-center justify-center gap-2"
              >
                <Icon name="messages" className="h-4 w-4" />
                <span>Open Chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const mId = selectedMatch.matchId;
                  setSelectedMatch(null);
                  handleUnmatch(mId);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
              >
                Unmatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
