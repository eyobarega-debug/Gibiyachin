import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import Icon from "../components/Icon";
import SocialPostCard from "../components/social/SocialPostCard";

export default function SavedPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadSavedPosts() {
      setLoading(true);
      try {
        const { data } = await client.get("/social/feed", {
          params: { tab: "saved", limit: 30 },
        });
        if (isMounted) {
          setPosts(data.posts || []);
        }
      } catch (err) {
        console.error("Failed to load saved posts:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSavedPosts();
    return () => {
      isMounted = false;
    };
  }, []);

  function handlePostUpdated(updated) {
    if (!updated.isBookmarked) {
      // If user unbookmarked, remove from list
      setPosts((prev) => prev.filter((p) => p.id !== updated.id));
    } else {
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  function handlePostDeleted(deletedId) {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3 pb-6 border-b border-slate-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-xs">
          <Icon name="bookmark" className="h-5 w-5 fill-current" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Saved Confessions</h1>
          <p className="text-xs text-slate-500">
            Anonymous confessions and stories you bookmarked for later.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass rounded-2xl p-6 border border-slate-200 bg-white/60 animate-pulse h-36"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-slate-200 bg-white/80">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Icon name="bookmark" className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No saved confessions</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              You haven't bookmarked any confessions yet. Click the bookmark icon on any confession in the wall to save it here.
            </p>
            <Link
              to="/confessions"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition"
            >
              Browse Confessions
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
