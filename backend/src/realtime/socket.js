const { Server } = require("socket.io");
const db = require("../db");
const { verifyAccessToken } = require("../utils/jwt");

let io = null;

// Track online users in memory: Map<userId, socketCount>
const onlineUsers = new Map();

// Helper to check if a user is an active participant in a conversation
async function isParticipant(conversationId, userId) {
  if (!conversationId || !userId) return false;
  const { rows } = await db.query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // Authentication & Tenant Verification Middleware
  io.use(async (socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!rawToken) {
        return next(new Error("Authentication token required"));
      }

      const token = rawToken.replace(/^Bearer\s+/i, "");
      const payload = verifyAccessToken(token);

      const { rows } = await db.query(
        "SELECT id, name, email, role, avatar_url, university_id, suspended FROM users WHERE id = $1",
        [payload.sub]
      );

      const user = rows[0];
      if (!user || user.suspended) {
        return next(new Error("Account invalid or suspended"));
      }
      if (!user.university_id) {
        return next(new Error("Account not attached to a university"));
      }

      // Attach authenticated identity
      socket.user = user;
      socket.userId = user.id;
      socket.universityId = user.university_id;
      next();
    } catch (err) {
      return next(new Error("Socket authentication failed: " + err.message));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    const universityId = socket.universityId;

    // Join user's personal room & university tenant room
    socket.join(`user:${userId}`);
    socket.join(`uni:${universityId}`);

    // Update presence
    const currentSockets = onlineUsers.get(userId) || 0;
    onlineUsers.set(userId, currentSockets + 1);

    if (currentSockets === 0) {
      // First socket for this user: broadcast online status to their university
      socket.to(`uni:${universityId}`).emit("presence:update", {
        userId,
        isOnline: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Send initial snapshot of currently online users in this university
    const onlineList = Array.from(onlineUsers.keys());
    socket.emit("presence:sync", { onlineUserIds: onlineList });

    // Join Conversation Room with strict membership verification
    socket.on("conversation:join", async ({ conversationId }, callback) => {
      try {
        const authorized = await isParticipant(conversationId, userId);
        if (!authorized) {
          if (typeof callback === "function") {
            return callback({ success: false, error: "FORBIDDEN", message: "Not a participant in this conversation" });
          }
          return;
        }

        socket.join(`conversation:${conversationId}`);
        if (typeof callback === "function") {
          callback({ success: true, conversationId });
        }
      } catch (err) {
        if (typeof callback === "function") callback({ success: false, error: err.message });
      }
    });

    // Leave Conversation Room
    socket.on("conversation:leave", ({ conversationId }, callback) => {
      socket.leave(`conversation:${conversationId}`);
      if (typeof callback === "function") {
        callback({ success: true, conversationId });
      }
    });

    // Typing Indicators (membership verified)
    socket.on("typing:start", async ({ conversationId }) => {
      try {
        const authorized = await isParticipant(conversationId, userId);
        if (authorized) {
          socket.to(`conversation:${conversationId}`).emit("typing:start", {
            conversationId,
            userId,
            name: socket.user.name,
          });
        }
      } catch (_) {}
    });

    socket.on("typing:stop", async ({ conversationId }) => {
      try {
        const authorized = await isParticipant(conversationId, userId);
        if (authorized) {
          socket.to(`conversation:${conversationId}`).emit("typing:stop", {
            conversationId,
            userId,
          });
        }
      } catch (_) {}
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      const remainingSockets = (onlineUsers.get(userId) || 1) - 1;
      if (remainingSockets <= 0) {
        onlineUsers.delete(userId);
        io.to(`uni:${universityId}`).emit("presence:update", {
          userId,
          isOnline: false,
          lastActive: new Date().toISOString(),
        });
      } else {
        onlineUsers.set(userId, remainingSockets);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

function isUserOnline(userId) {
  return (onlineUsers.get(userId) || 0) > 0;
}

function emitToUser(userId, event, payload) {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

function emitToConversation(conversationId, event, payload) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, payload);
  }
}

module.exports = {
  initSocketServer,
  getIO,
  isUserOnline,
  emitToUser,
  emitToConversation,
  onlineUsers,
};
