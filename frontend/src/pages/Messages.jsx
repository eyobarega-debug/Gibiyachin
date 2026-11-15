import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { client } from "../api/client";
import { useToast } from "../components/Toast";
import ConversationList from "../components/messaging/ConversationList";
import ChatWindow from "../components/messaging/ChatWindow";
import { BlockModal, ReportModal } from "../components/messaging/SafetyModals";

export default function Messages() {
  const { id: routeConvId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, sendTyping, typingMap } = useSocket();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Safety modals
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === routeConvId) || null;
  }, [conversations, routeConvId]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await client.get("/messages/conversations");
      setConversations(data || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when active conversation changes
  const loadMessages = useCallback(
    async (convId) => {
      if (!convId) {
        setMessages([]);
        return;
      }
      setLoadingMessages(true);
      try {
        const { data } = await client.get(`/messages/conversations/${convId}/messages`);
        setMessages(data || []);

        // Mark as read in backend
        client.post(`/messages/conversations/${convId}/read`).catch(() => {});

        // Reset local unread count
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  useEffect(() => {
    if (routeConvId) {
      loadMessages(routeConvId);

      // Join socket conversation room
      if (socket) {
        socket.emit("conversation:join", { conversationId: routeConvId });
      }

      return () => {
        if (socket) {
          socket.emit("conversation:leave", { conversationId: routeConvId });
        }
      };
    } else {
      setMessages([]);
    }
  }, [routeConvId, socket, loadMessages]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    function onNewMessage(msg) {
      if (msg.conversationId === routeConvId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto mark as read if active
        client.post(`/messages/conversations/${routeConvId}/read`).catch(() => {});
      }

      // Update conversation list item preview & timestamp
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === msg.conversationId);
        if (!existing) {
          loadConversations();
          return prev;
        }
        return prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessagePreview: msg.content || "Attachment",
                lastMessageAt: msg.createdAt,
                unreadCount:
                  msg.conversationId === routeConvId
                    ? 0
                    : msg.senderId !== user?.id
                    ? c.unreadCount + 1
                    : c.unreadCount,
              }
            : c
        );
      });
    }

    function onMessageEdited(data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id
            ? { ...m, content: data.content, isEdited: true, updatedAt: data.updatedAt }
            : m
        )
      );
    }

    function onMessageDeleted(data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, isDeleted: true, content: "This message was deleted", attachments: [] }
            : m
        )
      );
    }

    function onMessageRead(data) {
      if (data.conversationId === routeConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.id && m.status !== "read"
              ? { ...m, status: "read" }
              : m
          )
        );
      }
    }

    socket.on("message:new", onNewMessage);
    socket.on("message:edited", onMessageEdited);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("message:read", onMessageRead);
    socket.on("conversation:updated", loadConversations);

    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("message:edited", onMessageEdited);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("message:read", onMessageRead);
      socket.off("conversation:updated", loadConversations);
    };
  }, [socket, routeConvId, user?.id, loadConversations]);

  // Actions
  async function handleSendMessage({ content, attachments, replyToId }) {
    if (!routeConvId) return;
    try {
      const { data } = await client.post(`/messages/conversations/${routeConvId}/messages`, {
        content,
        attachments,
        replyToId,
      });
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to send message");
    }
  }

  async function handleEditMessage(messageId, content) {
    try {
      await client.patch(`/messages/messages/${messageId}`, { content });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m))
      );
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to edit message");
    }
  }

  async function handleDeleteMessage(messageId) {
    try {
      await client.delete(`/messages/messages/${messageId}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, content: "This message was deleted", attachments: [] }
            : m
        )
      );
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to delete message");
    }
  }

  async function handleToggleSetting(settings) {
    if (!routeConvId) return;
    try {
      const { data } = await client.patch(`/messages/conversations/${routeConvId}/settings`, settings);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === routeConvId
            ? {
                ...c,
                isPinned: data.isPinned !== undefined ? data.isPinned : c.isPinned,
                isArchived: data.isArchived !== undefined ? data.isArchived : c.isArchived,
                isMuted: data.isMuted !== undefined ? data.isMuted : c.isMuted,
              }
            : c
        )
      );
      toast.success("Conversation updated");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to update settings");
    }
  }

  async function handleBlockUser(targetUserId, reason) {
    try {
      await client.post("/messages/block", { targetUserId, reason });
      toast.success("User blocked");
      navigate("/messages");
      loadConversations();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to block user");
    }
  }

  async function handleReportUser(payload) {
    try {
      await client.post("/messages/report", payload);
      toast.success("Report submitted to campus moderation team");
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to submit report");
    }
  }

  const typingForActive = typingMap[routeConvId] || {};
  const typingUsers = Object.entries(typingForActive).filter(([uid]) => uid !== user?.id);
  const typingUserName = typingUsers.length > 0 ? typingUsers[0][1] : null;

  return (
    <div className="mx-auto max-w-[1600px] h-[calc(100vh-7rem)] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl flex">
      {/* Left panel: Conversation List */}
      <div
        className={`w-full lg:w-80 xl:w-96 shrink-0 h-full ${
          routeConvId ? "hidden lg:flex" : "flex"
        } flex-col`}
      >
        <ConversationList
          conversations={conversations}
          activeId={routeConvId}
          onSelect={(id) => navigate(`/messages/${id}`)}
          loading={loadingConversations}
        />
      </div>

      {/* Right panel: Chat Window */}
      <div
        className={`flex-1 h-full ${
          !routeConvId ? "hidden lg:flex" : "flex"
        } flex-col`}
      >
        <ChatWindow
          conversation={activeConversation}
          messages={messages}
          currentUserId={user?.id}
          loadingMessages={loadingMessages}
          onBack={() => navigate("/messages")}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onToggleSetting={handleToggleSetting}
          onBlockUser={() => setBlockModalOpen(true)}
          onReportUser={() => setReportModalOpen(true)}
          onTyping={(isTyping) => sendTyping(routeConvId, isTyping)}
          typingUserName={typingUserName}
        />
      </div>

      {/* Safety Modals */}
      <BlockModal
        targetUser={activeConversation?.participant}
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onConfirm={handleBlockUser}
      />

      <ReportModal
        targetUser={activeConversation?.participant}
        conversationId={routeConvId}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onConfirm={handleReportUser}
      />
    </div>
  );
}
