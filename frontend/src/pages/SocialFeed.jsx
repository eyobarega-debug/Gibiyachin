import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import { Button } from "../components/ui";
import PostComposer, { CONFESSION_CATEGORIES } from "../components/social/PostComposer";
import SocialPostCard from "../components/social/SocialPostCard";

const CONFESSION_TABS = [
  { key: "latest", label: "Latest 🕒" },
  { key: "trending", label: "Trending 🔥" },
  { key: "most_liked", label: "Most Liked ❤️" },
  { key: "most_discussed", label: "Most Discussed 💬" },
  { key: "my_posts", label: "My Confessions 🔒", authOnly: true },
  { key: "saved", label: "Saved 🔖", authOnly: true },
];

export default function SocialFeed({ initialTab }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const composerRef = useRef(null);

  const activeTab = searchParams.get("tab") || initialTab || "latest";
  const activeCategory = searchParams.get("category") || "All";
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const searchQuery = searchParams.get("search") || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
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

  const fetchPosts = useCallback(
    async (pageNum = 1, append = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = {
          tab: activeTab,
          page: pageNum,
          limit: 15,
        };
        if (activeCategory && activeCategory !== "All") {
          params.category = activeCategory;
        }
        if (searchQuery) params.search = searchQuery;

        const { data } = await client.get("/social/feed", { params });
        const newPosts = data.posts || [];

        if (append) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }

        setHasMore(data.pagination ? data.pagination.page < data.pagination.totalPages : newPosts.length === 15);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to load confessions feed:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab, activeCategory, searchQuery]
  );

  useEffect(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  function handleTabChange(tabKey) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tabKey);
    setSearchParams(next);
  }

  function handleCategoryChange(catName) {
    const next = new URLSearchParams(searchParams);
    if (catName === "All") {
      next.delete("category");
    } else {
      next.set("category", catName);
    }
    setSearchParams(next);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      next.set("search", searchInput.trim());
    } else {
      next.delete("search");
    }
    setSearchParams(next);
  }

  function handlePostCreated(newPost) {
    setPosts((prev) => [newPost, ...prev]);
    setShowComposer(false);
  }

  function handlePostUpdated(updatedPost) {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  }

  function handlePostDeleted(deletedId) {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  }

  function scrollToComposer() {
    setShowComposer(true);
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const visibleTabs = CONFESSION_TABS.filter((t) => !t.authOnly || Boolean(user));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-rose-200/80 bg-linear-to-r from-rose-500 via-pink-600 to-purple-600 p-6 sm:p-10 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-rose-400/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-xs shadow-xs">
              <Icon name="mask" className="h-4 w-4" />
              <span>Campus Anonymous Wall</span>
            </div>

            {myIdentity && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1 text-xs font-bold tracking-tight text-white border border-white/30 backdrop-blur-xs shadow-xs">
                <span>Your Identity:</span>
                <span className="font-extrabold underline decoration-white/60">{myIdentity.identity}</span>
              </div>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl text-white">
            Welcome to Gibiyachin Confessions ❤️🔥
          </h1>

          <p className="mt-1 text-xs sm:text-sm font-semibold tracking-wide text-rose-200 uppercase">
            "Your thoughts. Your stories. No identities."
          </p>

          <p className="mt-2 text-xs sm:text-sm text-rose-100/90 leading-relaxed">
            Share what's on your mind, tell your story and hear what others have to say. Your identity stays hidden from other students.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={scrollToComposer}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-rose-600 shadow-lg transition hover:bg-rose-50 hover:scale-105 active:scale-95"
            >
              <Icon name="plus" className="h-4 w-4" />
              <span>+ Share a Confession</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={() => handleTabChange("my_posts")}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition border backdrop-blur-xs ${
                  activeTab === "my_posts"
                    ? "bg-white text-slate-900 border-white shadow-md"
                    : "bg-white/10 text-white border-white/30 hover:bg-white/20"
                }`}
              >
                <Icon name="confession" className="h-4 w-4" />
                <span>My Private Confessions</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Grid: Feed + Navigation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Tabs & Quick Filters */}
        <aside className="hidden lg:col-span-3 lg:block space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sticky top-20 backdrop-blur-xs space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-2">
                Confession Streams
              </h3>
              <nav className="space-y-1">
                {visibleTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTabChange(tab.key)}
                      className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                        isActive
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                      }`}
                    >
                      <span>
                        {tab.key === "my_posts" && myIdentity ? `My Confessions (${myIdentity.identity})` : tab.label}
                      </span>
                      {isActive && <Icon name="fire" className="h-3.5 w-3.5 fill-current" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Privacy Guarantee Card */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5 text-xs text-rose-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <Icon name="shield" className="h-4 w-4" />
                <span>Strict Anonymity</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Other students will never see your name, avatar, or account info when you post, react, or comment.
              </p>
            </div>

            {/* Quick Links */}
            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
              <Link
                to="/community/announcements"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Icon name="announcement" className="h-4 w-4 text-blue-600" />
                <span>Official Announcements</span>
              </Link>

              {user && (
                <Link
                  to="/confessions/saved"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <Icon name="bookmark" className="h-4 w-4 text-purple-600" />
                  <span>Saved Confessions</span>
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* Center Feed Column */}
        <main className="lg:col-span-9 space-y-4">
          {/* Top Controls: Search Bar & Tab Pills (Mobile/Desktop) */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-3.5 shadow-sm space-y-3">
            {/* Search Input & Share Toggle */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Icon
                    name="search"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search confessions, secrets, or keywords..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-rose-400 focus:bg-white transition"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" className="rounded-2xl">
                  Search
                </Button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      const next = new URLSearchParams(searchParams);
                      next.delete("search");
                      setSearchParams(next);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                )}
              </form>

              <button
                type="button"
                onClick={() => setShowComposer((prev) => !prev)}
                className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
              >
                <Icon name={showComposer ? "close" : "plus"} className="h-4 w-4" />
                <span>{showComposer ? "Close Composer" : "+ Share Confession"}</span>
              </button>
            </div>

            {/* Horizontal Tabs Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
              {visibleTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={`shrink-0 rounded-2xl px-3.5 py-1.5 text-xs font-bold transition ${
                      isActive
                        ? "bg-rose-600 text-white shadow-xs"
                        : "border border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-white"
                    }`}
                  >
                    {tab.key === "my_posts" && myIdentity ? `My Confessions (${myIdentity.identity})` : tab.label}
                  </button>
                );
              })}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => handleCategoryChange("All")}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  activeCategory === "All"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Confessions
              </button>
              {CONFESSION_CATEGORIES.map((cat) => {
                const isSelected = activeCategory.toLowerCase() === cat.value.toLowerCase();
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategoryChange(cat.value)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition border ${
                      isSelected
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:border-rose-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collapsible Confession Composer */}
          <div ref={composerRef}>
            {showComposer && (
              <div className="animate-fade-in">
                <PostComposer
                  onPostCreated={handlePostCreated}
                  onCancel={() => setShowComposer(false)}
                />
              </div>
            )}
          </div>

          {/* Confessions Stream */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-slate-200/80 bg-white/70 p-5 shadow-xs animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-slate-200" />
                      <div className="h-2.5 w-16 rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="h-3 w-full rounded bg-slate-200" />
                    <div className="h-3 w-4/5 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-10 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-3 border border-rose-100">
                <Icon name="mask" className="h-7 w-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                {activeTab === "my_posts"
                  ? "You haven't posted any confessions yet"
                  : activeTab === "saved"
                  ? "No saved confessions yet"
                  : searchQuery
                  ? "No confessions match your search query"
                  : "No confessions in this category yet"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {activeTab === "my_posts"
                  ? "When you publish secret confessions, you can privately review and manage them right here."
                  : activeTab === "saved"
                  ? "Click the bookmark icon on any confession to save it secretly to your collection."
                  : "Be the first brave student to anonymously share a secret, love story, or campus thought!"}
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={scrollToComposer}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  <span>Share a Secret Confession</span>
                </button>
              </div>
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

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    loading={loadingMore}
                    onClick={() => fetchPosts(page + 1, true)}
                    className="rounded-2xl"
                  >
                    Load More Confessions
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
