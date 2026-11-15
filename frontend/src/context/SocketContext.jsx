import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "../api/client";
import { client } from "../api/client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingMap, setTypingMap] = useState({}); // { [conversationId]: { [userId]: userName } }

  const typingTimeoutRef = useRef({});

  // Fetch initial unread messages count
  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data } = await client.get("/messages/unread-count");
      setUnreadCount(data?.total || 0);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      setIsConnected(false);
      setOnlineUsers(new Set());
      setUnreadCount(0);
      return;
    }

    refreshUnreadCount();

    const token = getAccessToken();
    const socketUrl = import.meta.env.VITE_SOCKET_URL || "/";

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    newSocket.on("connect_error", () => {
      setIsConnected(false);
    });

    // Initial presence sync
    newSocket.on("presence:sync", ({ onlineUserIds }) => {
      if (Array.isArray(onlineUserIds)) {
        setOnlineUsers(new Set(onlineUserIds));
      }
    });

    // Presence update
    newSocket.on("presence:update", ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    // Real-time unread messages update
    newSocket.on("conversation:updated", () => {
      refreshUnreadCount();
    });

    newSocket.on("message:read", () => {
      refreshUnreadCount();
    });

    // Typing indicators
    newSocket.on("typing:start", ({ conversationId, userId, name }) => {
      setTypingMap((prev) => {
        const current = prev[conversationId] || {};
        return {
          ...prev,
          [conversationId]: { ...current, [userId]: name },
        };
      });

      // Clear existing auto-stop timer
      const key = `${conversationId}:${userId}`;
      if (typingTimeoutRef.current[key]) {
        clearTimeout(typingTimeoutRef.current[key]);
      }
      typingTimeoutRef.current[key] = setTimeout(() => {
        setTypingMap((prev) => {
          const current = { ...(prev[conversationId] || {}) };
          delete current[userId];
          return { ...prev, [conversationId]: current };
        });
      }, 4000);
    });

    newSocket.on("typing:stop", ({ conversationId, userId }) => {
      const key = `${conversationId}:${userId}`;
      if (typingTimeoutRef.current[key]) {
        clearTimeout(typingTimeoutRef.current[key]);
      }
      setTypingMap((prev) => {
        const current = { ...(prev[conversationId] || {}) };
        delete current[userId];
        return { ...prev, [conversationId]: current };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, refreshUnreadCount]);

  const isUserOnline = useCallback(
    (userId) => {
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  const sendTyping = useCallback(
    (conversationId, isTyping) => {
      if (!socket || !conversationId) return;
      if (isTyping) {
        socket.emit("typing:start", { conversationId });
      } else {
        socket.emit("typing:stop", { conversationId });
      }
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        isUserOnline,
        unreadCount,
        refreshUnreadCount,
        typingMap,
        sendTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
