import { useState, useEffect } from "react";
import { client } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";
import Icon from "../Icon";
import { Button } from "../ui";
import ReportModal from "./ReportModal";
import { getAnonymousPalette } from "../../utils/anonymousAvatar";

function timeAgo(dateString) {
  if (!dateString) return "";
  const sec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  return new Date(dateString).toLocaleDateString();
}

export default function CommentSection({ postId, onCommentCountChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Replying state
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Reporting state
  const [reportingId, setReportingId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadComments() {
      setLoading(true);
      try {
        const { data } = await client.get(`/social/posts/${postId}/comments`);
        if (isMounted) {
          setComments(data.comments || []);
        }
      } catch (err) {
        // silent fail on load
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadComments();
    return () => {
      isMounted = false;
    };
  }, [postId]);

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data } = await client.post(`/social/posts/${postId}/comments`, {
        content: newContent.trim(),
      });
      setComments((prev) => [...prev, data.comment]);
      setNewContent("");
      if (onCommentCountChange) onCommentCountChange(1);
      toast.success("Comment posted anonymously");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddReply(parentId) {
    if (!replyContent.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const { data } = await client.post(`/social/posts/${postId}/comments`, {
        content: replyContent.trim(),
        parentCommentId: parentId,
      });

      // Insert reply under the parent
      setComments((prev) => {
        return prev.map((c) => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: [...(c.replies || []), data.comment],
              repliesCount: (c.repliesCount || 0) + 1,
            };
          }
          return c;
        });
      });

      setReplyingToId(null);
      setReplyContent("");
      if (onCommentCountChange) onCommentCountChange(1);
      toast.success("Reply posted anonymously");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to post reply");
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleLikeComment(commentId, isReply = false, parentId = null) {
    if (!user) {
      toast.info("Please sign in to like comments");
      return;
    }

    try {
      const { data } = await client.post(`/social/comments/${commentId}/like`);

      setComments((prev) => {
        if (!isReply) {
          return prev.map((c) =>
            c.id === commentId
              ? { ...c, isLiked: data.liked, likesCount: data.likesCount }
              : c
          );
        }
        return prev.map((c) => {
          if (c.id === parentId && c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId
                  ? { ...r, isLiked: data.liked, likesCount: data.likesCount }
                  : r
              ),
            };
          }
          return c;
        });
      });
    } catch (err) {
      toast.error("Failed to update like");
    }
  }

  async function handleEditComment(commentId, isReply = false, parentId = null) {
    if (!editContent.trim() || submittingEdit) return;

    setSubmittingEdit(true);
    try {
      const { data } = await client.patch(`/social/comments/${commentId}`, {
        content: editContent.trim(),
      });

      setComments((prev) => {
        if (!isReply) {
          return prev.map((c) => (c.id === commentId ? { ...c, content: data.comment.content, updatedAt: data.comment.updatedAt } : c));
        }
        return prev.map((c) => {
          if (c.id === parentId && c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) => (r.id === commentId ? { ...r, content: data.comment.content, updatedAt: data.comment.updatedAt } : r)),
            };
          }
          return c;
        });
      });

      setEditingId(null);
      setEditContent("");
      toast.success("Comment updated");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to edit comment");
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function handleDeleteComment(commentId, isReply = false, parentId = null) {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    try {
      await client.delete(`/social/comments/${commentId}`);

      setComments((prev) => {
        if (!isReply) {
          return prev.filter((c) => c.id !== commentId);
        }
        return prev.map((c) => {
          if (c.id === parentId && c.replies) {
            return {
              ...c,
              replies: c.replies.filter((r) => r.id !== commentId),
            };
          }
          return c;
        });
      });

      if (onCommentCountChange) onCommentCountChange(-1);
      toast.success("Comment deleted");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to delete comment");
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      {/* Add comment input (Strictly anonymous) */}
      {user ? (
        <form onSubmit={handleAddComment} className="flex items-start gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-linear-to-tr from-slate-200 to-slate-100 text-slate-600 border border-slate-200/80 shadow-2xs">
            <Icon name="mask" className="h-4 w-4" />
          </div>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Comment secretly as Anonymous..."
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-rose-400 focus:bg-white transition placeholder:text-slate-400"
              maxLength={1000}
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!newContent.trim() || submitting}
              className="bg-slate-900 text-white hover:bg-slate-800 border-none rounded-xl"
            >
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center text-xs text-slate-500">
          Sign in to post anonymous comments and replies.
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          No comments yet. Be the first to share your secret reaction!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const cp = getAnonymousPalette(comment.authorName);
            return (
              <div key={comment.id} className="group/item text-xs sm:text-sm">
                {/* Top-level comment */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-linear-to-tr ${cp.gradient} text-white border ${cp.border} mt-0.5 shadow-2xs`}
                  >
                    <Icon name="mask" className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl bg-slate-100/80 px-3.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{comment.authorName}</span>
                          {comment.isPostAuthor && (
                            <span className="rounded-full bg-violet-100 text-violet-700 border border-violet-200 text-[9px] font-bold px-1.5 py-0.2">
                              Author
                            </span>
                          )}
                          {comment.isAuthor && (
                            <span className="rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.2">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{timeAgo(comment.createdAt)}</span>
                      </div>

                    {editingId === comment.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={2}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditContent("");
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            loading={submittingEdit}
                            onClick={() => handleEditComment(comment.id)}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-slate-800 break-words whitespace-pre-wrap">{comment.content}</p>
                    )}
                  </div>

                  {/* Actions under comment */}
                  <div className="mt-1 flex items-center gap-3 pl-2 text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleLikeComment(comment.id)}
                      className={`font-semibold transition hover:text-slate-800 ${
                        comment.isLiked ? "text-rose-600 font-bold" : ""
                      }`}
                    >
                      {comment.isLiked ? "Liked" : "Like"} {comment.likesCount > 0 && `(${comment.likesCount})`}
                    </button>

                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(replyingToId === comment.id ? null : comment.id);
                          setReplyContent("");
                        }}
                        className="font-semibold hover:text-slate-800"
                      >
                        Reply
                      </button>
                    )}

                    {comment.isAuthor ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="hover:text-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="hover:text-red-600"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReportingId(comment.id)}
                        className="hover:text-slate-700"
                      >
                        Report
                      </button>
                    )}
                  </div>

                  {/* Reply Input Form */}
                  {replyingToId === comment.id && (
                    <div className="mt-2.5 pl-4 flex gap-2">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Reply secretly as Anonymous..."
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-400"
                      />
                      <Button
                        type="button"
                        size="sm"
                        loading={submittingReply}
                        onClick={() => handleAddReply(comment.id)}
                        className="bg-slate-900 text-white rounded-xl"
                      >
                        Reply
                      </Button>
                    </div>
                  )}

                  {/* Nested Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-slate-200/60 space-y-2.5">
                      {comment.replies.map((reply) => {
                        const rp = getAnonymousPalette(reply.authorName);
                        return (
                          <div key={reply.id} className="group/reply flex items-start gap-2">
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-tr ${rp.gradient} text-white mt-0.5 shadow-2xs border ${rp.border}`}
                            >
                              <Icon name="mask" className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="rounded-2xl bg-slate-100/70 px-3 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-bold text-slate-900">{reply.authorName}</span>
                                    {reply.isPostAuthor && (
                                      <span className="rounded-full bg-violet-100 text-violet-700 border border-violet-200 text-[8px] font-bold px-1.5">
                                        Author
                                      </span>
                                    )}
                                    {reply.isAuthor && (
                                      <span className="rounded-full bg-slate-200 text-slate-700 text-[8px] font-bold px-1.5">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">{timeAgo(reply.createdAt)}</span>
                                </div>
                              {editingId === reply.id ? (
                                <div className="mt-2 space-y-2">
                                  <textarea
                                    rows={2}
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 outline-none"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingId(null);
                                        setEditContent("");
                                      }}
                                      className="text-xs text-slate-500 hover:text-slate-800"
                                    >
                                      Cancel
                                    </button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      loading={submittingEdit}
                                      onClick={() => handleEditComment(reply.id, true, comment.id)}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-0.5 text-slate-800 break-words whitespace-pre-wrap">{reply.content}</p>
                              )}
                            </div>

                            {/* Reply actions */}
                            <div className="mt-0.5 flex items-center gap-3 pl-2 text-[10px] text-slate-500">
                              <button
                                type="button"
                                onClick={() => handleLikeComment(reply.id, true, comment.id)}
                                className={`font-semibold transition hover:text-slate-800 ${
                                  reply.isLiked ? "text-rose-600 font-bold" : ""
                                }`}
                              >
                                {reply.isLiked ? "Liked" : "Like"} {reply.likesCount > 0 && `(${reply.likesCount})`}
                              </button>

                              {reply.isAuthor ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(reply.id);
                                      setEditContent(reply.content);
                                    }}
                                    className="hover:text-slate-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(reply.id, true, comment.id)}
                                    className="hover:text-red-600"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReportingId(reply.id)}
                                  className="hover:text-slate-700"
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Safety Report Modal */}
      <ReportModal
        isOpen={Boolean(reportingId)}
        onClose={() => setReportingId(null)}
        targetType="comment"
        targetId={reportingId}
      />
    </div>
  );
}
