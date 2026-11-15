import { useState } from "react";
import Icon from "../Icon";

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({
  message,
  isMine,
  onReply,
  onEdit,
  onDelete,
}) {
  const [showActions, setShowActions] = useState(false);

  const isDeleted = message.isDeleted;

  return (
    <div
      className={`group relative flex w-full flex-col ${
        isMine ? "items-end" : "items-start"
      } my-1.5 px-3`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-xs transition ${
          isMine
            ? "bg-[#1c222c] text-white rounded-br-xs"
            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
        } ${isDeleted ? "opacity-75 italic" : ""}`}
      >
        {/* Reply Quote Preview */}
        {message.reply && !isDeleted && (
          <div
            className={`mb-2 rounded-lg border-l-2 py-1 px-2.5 text-xs ${
              isMine
                ? "bg-white/10 border-white/60 text-white/90"
                : "bg-slate-50 border-slate-400 text-slate-600"
            }`}
          >
            <p className="font-semibold text-[11px] truncate">
              {message.reply.senderName || "User"}
            </p>
            <p className="truncate text-[11px]">{message.reply.content}</p>
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && !isDeleted && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-xl border border-black/10 transition hover:opacity-90"
              >
                {att.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <img
                    src={att.url}
                    alt={att.name || "Attachment"}
                    className="max-h-60 max-w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-black/10 p-2 text-xs font-medium">
                    <Icon name="file" className="h-4 w-4" />
                    <span className="truncate max-w-[150px]">
                      {att.name || "Document"}
                    </span>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Message Content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Timestamp & Status Metadata */}
        <div
          className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
            isMine ? "text-slate-300" : "text-slate-400"
          }`}
        >
          {message.isEdited && !isDeleted && <span>(edited)</span>}
          <span>{formatTime(message.createdAt)}</span>

          {isMine && !isDeleted && (
            <span className="inline-flex items-center">
              {message.status === "read" ? (
                <span className="text-sky-400" title="Read">
                  ✓✓
                </span>
              ) : message.status === "delivered" ? (
                <span className="text-slate-400" title="Delivered">
                  ✓✓
                </span>
              ) : (
                <span className="text-slate-400" title="Sent">
                  ✓
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Hover Action Toolbar */}
      {!isDeleted && showActions && (
        <div
          className={`absolute top-0 -translate-y-1/2 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-md z-10 transition animate-fade-in ${
            isMine ? "right-2" : "left-2"
          }`}
        >
          <button
            type="button"
            onClick={() => onReply(message)}
            title="Reply"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <Icon name="arrowLeft" className="h-3.5 w-3.5" />
          </button>

          {isMine && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message)}
              title="Edit Message"
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <Icon name="edit" className="h-3.5 w-3.5" />
            </button>
          )}

          {isMine && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message)}
              title="Delete Message"
              className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
