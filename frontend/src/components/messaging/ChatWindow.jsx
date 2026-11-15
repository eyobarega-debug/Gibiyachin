import { useState, useEffect, useRef } from "react";
import Icon from "../Icon";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import ContextBanner from "./ContextBanner";

export default function ChatWindow({
  conversation,
  messages,
  currentUserId,
  loadingMessages,
  onBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleSetting,
  onBlockUser,
  onReportUser,
  onTyping,
  typingUserName,
}) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const participant = conversation?.participant;

  // Auto-scroll to bottom on messages load/change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm mb-3">
          <Icon name="messages" className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-base font-bold text-slate-700">Select a Conversation</p>
        <p className="mt-1 text-xs text-slate-400 max-w-sm">
          Choose a conversation from the list to view message history and reply in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50/40">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Back to conversations"
          >
            <Icon name="arrowLeft" className="h-5 w-5" />
          </button>

          {/* Participant Info */}
          <div className="relative shrink-0">
            {participant?.avatarUrl ? (
              <img
                src={participant.avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white shadow-xs">
                {participant?.name ? participant.name[0].toUpperCase() : "U"}
              </div>
            )}
            {participant?.isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">
              {participant?.name || "Campus User"}
            </h3>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {participant?.isOnline ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span>Offline</span>
              )}
              {participant?.role && (
                <>
                  <span>•</span>
                  <span className="capitalize">{participant.role}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <Icon name="dots" className="h-5 w-5" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-48 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl z-20 animate-fade-in"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleSetting({ isPinned: !conversation.isPinned });
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>{conversation.isPinned ? "Unpin Conversation" : "Pin Conversation"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleSetting({ isArchived: !conversation.isArchived });
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>{conversation.isArchived ? "Unarchive" : "Archive"}</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onBlockUser();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                <Icon name="ban" className="h-4 w-4" />
                <span>Block User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReportUser();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-amber-600 hover:bg-amber-50"
              >
                <Icon name="alert" className="h-4 w-4" />
                <span>Report</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Context Banner (Product, Listing, Rental, Lost & Found, Dating) */}
      <ContextBanner
        type={conversation.type}
        contextType={conversation.contextType}
        contextId={conversation.contextId}
        contextData={conversation.contextData}
      />

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loadingMessages ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="mt-2">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <p className="font-semibold text-slate-700">No messages yet</p>
            <p className="mt-1">Send a message below to start the conversation.</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.senderId === currentUserId}
              onReply={(msg) => setReplyingTo(msg)}
              onEdit={(msg) => setEditingMessage(msg)}
              onDelete={(msg) => onDeleteMessage(msg.id)}
            />
          ))
        )}

        {/* Typing status */}
        {typingUserName && (
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 italic">
            <span className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </span>
            <span>{typingUserName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer or Disabled Notice */}
      {conversation.isDatingUnmatched ? (
        <div className="border-t border-slate-200 bg-slate-100/90 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <Icon name="heart" className="h-4 w-4 text-slate-400" />
            <span>This match has ended. Messaging is no longer available.</span>
          </div>
        </div>
      ) : participant?.isBlocked ? (
        <div className="border-t border-slate-200 bg-slate-100/90 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <Icon name="ban" className="h-4 w-4 text-rose-500" />
            <span>Messaging is unavailable because one or both users have blocked communication.</span>
          </div>
        </div>
      ) : (
        <MessageComposer
          conversationId={conversation.id}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onSendMessage={onSendMessage}
          onEditMessage={onEditMessage}
          onTyping={onTyping}
        />
      )}
    </div>
  );
}
