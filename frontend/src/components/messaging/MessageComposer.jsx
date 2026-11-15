import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";
import { client } from "../../api/client";

export default function MessageComposer({
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSendMessage,
  onEditMessage,
  onTyping,
}) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Sync editing message
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content || "");
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [editingMessage]);

  function handleTypingChange(e) {
    setContent(e.target.value);

    if (onTyping) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 2500);
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await client.post("/uploads", formData);
        setAttachments((prev) => [
          ...prev,
          {
            url: data.url,
            name: file.name,
            type: file.type,
            size: file.size,
          },
        ]);
      }
    } catch (err) {
      console.error("Attachment upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();

    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    if (editingMessage) {
      await onEditMessage(editingMessage.id, trimmed);
      setContent("");
      if (onCancelEdit) onCancelEdit();
      return;
    }

    if (onTyping) onTyping(false);

    await onSendMessage({
      content: trimmed,
      attachments,
      replyToId: replyingTo?.id || null,
    });

    setContent("");
    setAttachments([]);
    if (onCancelReply) onCancelReply();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-slate-200/80 bg-white p-3">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="arrowLeft" className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">
              Replying to {replyingTo.senderName || "User"}:
            </span>
            <span className="truncate text-slate-500">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-800 border border-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="edit" className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="font-semibold">Editing message</span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-full p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-800"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div
              key={idx}
              className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs"
            >
              {att.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img src={att.url} alt="" className="h-6 w-6 rounded-md object-cover" />
              ) : (
                <Icon name="file" className="h-4 w-4 text-slate-500" />
              )}
              <span className="max-w-[120px] truncate text-slate-700 font-medium">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <Icon name="close" className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form Controls */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          accept="image/*"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          title="Attach photos"
        >
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent inline-block" />
          ) : (
            <Icon name="image" className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/5 transition">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleTypingChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden max-h-32"
          />
        </div>

        <button
          type="submit"
          disabled={!content.trim() && attachments.length === 0}
          className="rounded-2xl bg-[#1c222c] hover:bg-[#2c3545] p-2.5 text-white shadow-xs transition hover:scale-102 active:scale-98 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          title={editingMessage ? "Save edit" : "Send message"}
        >
          <Icon name="arrowRight" className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
