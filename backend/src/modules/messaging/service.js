const db = require("../../db");
const { badRequest, forbidden, notFound } = require("../../utils/errors");
const { emitToConversation, emitToUser, isUserOnline } = require("../../realtime/socket");
const { notify } = require("../../utils/notify");

/**
 * Format conversation record with other participant and presence info
 */
function formatConversation(row, currentUserId) {
  return {
    id: row.id,
    universityId: row.university_id,
    type: row.type,
    contextType: row.context_type,
    contextId: row.context_id,
    contextData: row.context_data || null,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    isMuted: Boolean(row.is_muted),
    unreadCount: parseInt(row.unread_count || "0", 10),
    isDatingUnmatched: Boolean(row.is_dating_unmatched),
    participant: row.other_user_id
      ? {
          id: row.other_user_id,
          name: row.other_user_name,
          email: row.other_user_email,
          role: row.other_user_role,
          avatarUrl: row.other_user_avatar,
          isOnline: isUserOnline(row.other_user_id),
          isBlocked: Boolean(row.is_blocked),
        }
      : null,
  };
}

/**
 * List conversations for the authenticated user
 */
async function getConversations(userId, universityId, { type, search, archived = false } = {}) {
  const params = [userId];
  const conditions = ["cp.user_id = $1", "cp.is_archived = $" + (params.length + 1)];
  params.push(archived);

  if (universityId) {
    params.push(universityId);
    conditions.push("c.university_id = $" + params.length);
  }

  if (type && type !== "all") {
    params.push(type);
    conditions.push("c.type = $" + params.length);
  }

  let searchJoin = "";
  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const searchIdx = params.length;
    conditions.push(`(LOWER(other_u.name) LIKE $${searchIdx} OR LOWER(c.last_message_preview) LIKE $${searchIdx})`);
  }

  const query = `
    SELECT 
      c.id, c.university_id, c.type, c.context_type, c.context_id, c.context_data,
      c.last_message_at, c.last_message_preview, c.created_at, c.updated_at,
      cp.is_pinned, cp.is_archived, cp.is_muted, cp.unread_count,
      other_u.id as other_user_id,
      other_u.name as other_user_name,
      other_u.email as other_user_email,
      other_u.role as other_user_role,
      other_u.avatar_url as other_user_avatar,
      EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id = $1 AND ub.blocked_id = other_u.id)
           OR (ub.blocker_id = other_u.id AND ub.blocked_id = $1)
      ) as is_blocked,
      CASE 
        WHEN c.type = 'dating' AND c.context_id IS NOT NULL THEN COALESCE((
          SELECT status != 'active' FROM dating_matches WHERE id::text = c.context_id
        ), false)
        ELSE false
      END as is_dating_unmatched
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    LEFT JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != $1
    LEFT JOIN users other_u ON other_u.id = other_cp.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY cp.is_pinned DESC, COALESCE(c.last_message_at, c.created_at) DESC
  `;

  const { rows } = await db.query(query, params);
  return rows.map((r) => formatConversation(r, userId));
}

/**
 * Get or create a 1-on-1 conversation
 */
async function getOrCreateConversation({ recipientId, type = "general", contextType, contextId, contextData }, userId, universityId) {
  if (recipientId === userId) {
    throw badRequest("You cannot start a conversation with yourself");
  }

  // 1. Verify recipient exists and is not suspended
  const { rows: userRows } = await db.query(
    "SELECT id, name, email, role, avatar_url, university_id, suspended FROM users WHERE id = $1",
    [recipientId]
  );
  const recipient = userRows[0];
  if (!recipient || recipient.suspended) {
    throw notFound("Recipient user not found or account is suspended");
  }

  // 2. Strict University Tenant Scoping
  if (universityId && recipient.university_id !== universityId) {
    throw forbidden("Cannot message users outside of your university");
  }

  // 3. Block check: either user has blocked the other
  const { rows: blockRows } = await db.query(
    `SELECT 1 FROM user_blocks 
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)`,
    [userId, recipientId]
  );
  if (blockRows.length > 0) {
    throw forbidden("Messaging is unavailable because one or both users have blocked communication");
  }

  // 4. If dating conversation: verify active mutual match exists
  if (type === "dating") {
    const minId = userId < recipientId ? userId : recipientId;
    const maxId = userId < recipientId ? recipientId : userId;
    const { rows: matchRows } = await db.query(
      `SELECT id, status FROM dating_matches WHERE user_a_id = $1 AND user_b_id = $2 AND status = 'active'`,
      [minId, maxId]
    );
    if (!matchRows.length) {
      throw forbidden("Dating conversations can only be started with mutual matches");
    }
  }

  // 5. Look for existing conversation between these two users
  let findQuery;
  let findParams;

  if (contextType && contextId) {
    findQuery = `
      SELECT c.id 
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      WHERE c.context_type = $3 AND c.context_id = $4
      LIMIT 1
    `;
    findParams = [userId, recipientId, contextType, contextId];
  } else if (type === "dating") {
    findQuery = `
      SELECT c.id 
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      WHERE c.type = 'dating'
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    findParams = [userId, recipientId];
  } else {
    findQuery = `
      SELECT c.id 
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      WHERE c.context_type IS NULL AND (c.type = $3 OR c.type = 'general')
      LIMIT 1
    `;
    findParams = [userId, recipientId, type];
  }

  const { rows: existingRows } = await db.query(findQuery, findParams);

  if (existingRows.length > 0) {
    const conversationId = existingRows[0].id;
    // Unarchive for both participants if archived
    await db.query(
      `UPDATE conversation_participants SET is_archived = false WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return getConversationById(conversationId, userId, universityId);
  }

  // 6. Create new conversation in transaction
  const newConv = await db.withTransaction(async (client) => {
    const effectiveUniId = universityId || recipient.university_id;

    const { rows: newConvRows } = await client.query(
      `INSERT INTO conversations (university_id, type, context_type, context_id, context_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [effectiveUniId, type, contextType || null, contextId || null, JSON.stringify(contextData || {})]
    );
    const conv = newConvRows[0];

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [conv.id, userId, recipientId]
    );

    return conv;
  });

  return getConversationById(newConv.id, userId, universityId);
}

/**
 * Get single conversation details by ID
 */
async function getConversationById(conversationId, userId, universityId) {
  const query = `
    SELECT 
      c.id, c.university_id, c.type, c.context_type, c.context_id, c.context_data,
      c.last_message_at, c.last_message_preview, c.created_at, c.updated_at,
      cp.is_pinned, cp.is_archived, cp.is_muted, cp.unread_count,
      other_u.id as other_user_id,
      other_u.name as other_user_name,
      other_u.email as other_user_email,
      other_u.role as other_user_role,
      other_u.avatar_url as other_user_avatar,
      EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id = $1 AND ub.blocked_id = other_u.id)
           OR (ub.blocker_id = other_u.id AND ub.blocked_id = $1)
      ) as is_blocked,
      CASE 
        WHEN c.type = 'dating' AND c.context_id IS NOT NULL THEN COALESCE((
          SELECT status != 'active' FROM dating_matches WHERE id::text = c.context_id
        ), false)
        ELSE false
      END as is_dating_unmatched
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
    LEFT JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != $1
    LEFT JOIN users other_u ON other_u.id = other_cp.user_id
    WHERE c.id = $2
  `;

  const { rows } = await db.query(query, [userId, conversationId]);
  if (!rows.length) {
    throw notFound("Conversation not found or you are not a participant");
  }

  const row = rows[0];
  if (universityId && row.university_id !== universityId) {
    throw forbidden("Cannot access conversation from another university");
  }

  return formatConversation(row, userId);
}

/**
 * Get messages inside a conversation with pagination
 */
async function getMessages(conversationId, userId, { limit = 50, before } = {}) {
  // 1. Participant check
  const { rows: partRows } = await db.query(
    "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
    [conversationId, userId]
  );
  if (!partRows.length) {
    throw forbidden("You are not a participant in this conversation");
  }

  const params = [conversationId];
  let beforeCondition = "";

  if (before) {
    params.push(before);
    beforeCondition = "AND (m.created_at < $2 OR m.id = $2)";
  }

  params.push(limit);
  const limitIdx = params.length;

  const query = `
    SELECT 
      m.id, m.conversation_id, m.sender_id, m.content, m.attachments,
      m.reply_to_id, m.status, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
      u.name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role,
      r.content as reply_content,
      ru.name as reply_sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages r ON r.id = m.reply_to_id
    LEFT JOIN users ru ON ru.id = r.sender_id
    WHERE m.conversation_id = $1 ${beforeCondition}
    ORDER BY m.created_at DESC
    LIMIT $${limitIdx}
  `;

  const { rows } = await db.query(query, params);

  // Return in ascending (chronological) order for chat stream
  return rows.reverse().map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    senderAvatar: m.sender_avatar,
    senderRole: m.sender_role,
    content: m.is_deleted ? "This message was deleted" : m.content,
    attachments: m.is_deleted ? [] : m.attachments || [],
    replyToId: m.reply_to_id,
    reply: m.reply_to_id
      ? {
          id: m.reply_to_id,
          content: m.reply_content,
          senderName: m.reply_sender_name,
        }
      : null,
    status: m.status,
    isEdited: m.is_edited,
    isDeleted: m.is_deleted,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  }));
}

/**
 * Send a message inside a conversation
 */
async function sendMessage(conversationId, { content, attachments = [], replyToId = null }, senderId) {
  // 1. Participant check
  const { rows: partRows } = await db.query(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = $1",
    [conversationId]
  );
  if (!partRows.some((p) => p.user_id === senderId)) {
    throw forbidden("You are not a participant in this conversation");
  }

  const recipientIds = partRows.map((p) => p.user_id).filter((uid) => uid !== senderId);

  // 2. Dating unmatch check: ensure match is active if dating conversation
  const { rows: convRows } = await db.query(
    "SELECT type, context_type, context_id FROM conversations WHERE id = $1",
    [conversationId]
  );
  if (convRows.length > 0 && convRows[0].type === "dating") {
    const matchId = convRows[0].context_id;
    if (matchId) {
      const { rows: matchRows } = await db.query(
        "SELECT status FROM dating_matches WHERE id::text = $1",
        [String(matchId)]
      );
      if (matchRows.length > 0 && matchRows[0].status !== "active") {
        throw forbidden("Messaging is disabled because this match has ended");
      }
    }
  }

  // 3. Block check between participants
  for (const recId of recipientIds) {
    const { rows: blockRows } = await db.query(
      `SELECT 1 FROM user_blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [senderId, recId]
    );
    if (blockRows.length > 0) {
      throw forbidden("Cannot send message: one or both users have blocked communication");
    }
  }

  // 3. Sender info for payload and notification
  const { rows: senderRows } = await db.query("SELECT id, name, avatar_url, role FROM users WHERE id = $1", [senderId]);
  const sender = senderRows[0];

  // 4. Validate replyTo if provided
  let replyObj = null;
  if (replyToId) {
    const { rows: replyRows } = await db.query(
      `SELECT m.id, m.content, u.name as sender_name 
       FROM messages m 
       JOIN users u ON u.id = m.sender_id 
       WHERE m.id = $1 AND m.conversation_id = $2`,
      [replyToId, conversationId]
    );
    if (replyRows.length > 0) {
      replyObj = {
        id: replyRows[0].id,
        content: replyRows[0].content,
        senderName: replyRows[0].sender_name,
      };
    }
  }

  const preview =
    content && content.trim()
      ? content.trim().length > 60
        ? content.trim().slice(0, 57) + "..."
        : content.trim()
      : attachments.length > 0
      ? `📷 [${attachments.length} Attachment${attachments.length > 1 ? "s" : ""}]`
      : "Message";

  const message = await db.withTransaction(async (client) => {
    const { rows: msgRows } = await client.query(
      `INSERT INTO messages (conversation_id, sender_id, content, attachments, reply_to_id, status)
       VALUES ($1, $2, $3, $4, $5, 'sent')
       RETURNING *`,
      [conversationId, senderId, content ? content.trim() : null, JSON.stringify(attachments), replyToId || null]
    );
    const msg = msgRows[0];

    // Update conversation last message preview
    await client.query(
      `UPDATE conversations 
       SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW() 
       WHERE id = $2`,
      [preview, conversationId]
    );

    // Update recipient participants unread counts and unarchive
    for (const recId of recipientIds) {
      await client.query(
        `UPDATE conversation_participants 
         SET unread_count = unread_count + 1, is_archived = false 
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, recId]
      );

      // Record receipt
      await client.query(
        `INSERT INTO message_receipts (message_id, user_id, status)
         VALUES ($1, $2, 'delivered')
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [msg.id, recId]
      );
    }

    return msg;
  });

  const payload = {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: sender.id,
    senderName: sender.name,
    senderAvatar: sender.avatar_url,
    senderRole: sender.role,
    content: message.content,
    attachments: message.attachments || [],
    replyToId: message.reply_to_id,
    reply: replyObj,
    status: message.status,
    isEdited: message.is_edited,
    isDeleted: message.is_deleted,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
  };

  // Real-time broadcast
  emitToConversation(conversationId, "message:new", payload);

  for (const recId of recipientIds) {
    emitToUser(recId, "conversation:updated", {
      conversationId,
      lastMessage: preview,
      lastMessageAt: message.created_at,
      senderId,
    });

    // Notify recipient
    notify(
      recId,
      "message_new",
      `${sender.name}`,
      preview,
      {
        targetRoute: `/messages/${conversationId}`,
        targetEntityType: "conversation",
        targetEntityId: conversationId,
      }
    ).catch((err) => console.warn("[messaging] notify failed:", err.message));
  }

  emitToUser(senderId, "conversation:updated", {
    conversationId,
    lastMessage: preview,
    lastMessageAt: message.created_at,
    senderId,
  });

  return payload;
}

/**
 * Edit an existing message
 */
async function editMessage(messageId, content, userId) {
  const { rows } = await db.query(
    "SELECT id, conversation_id, sender_id, is_deleted FROM messages WHERE id = $1",
    [messageId]
  );
  if (!rows.length) {
    throw notFound("Message not found");
  }
  const msg = rows[0];

  if (msg.sender_id !== userId) {
    throw forbidden("You can only edit your own messages");
  }
  if (msg.is_deleted) {
    throw badRequest("Cannot edit a deleted message");
  }

  const { rows: updatedRows } = await db.query(
    `UPDATE messages 
     SET content = $1, is_edited = true, updated_at = NOW() 
     WHERE id = $2 
     RETURNING *`,
    [content.trim(), messageId]
  );
  const updated = updatedRows[0];

  const payload = {
    id: updated.id,
    conversationId: updated.conversation_id,
    content: updated.content,
    isEdited: true,
    updatedAt: updated.updated_at,
  };

  emitToConversation(updated.conversation_id, "message:edited", payload);
  return payload;
}

/**
 * Soft delete a message
 */
async function deleteMessage(messageId, userId, isAdmin = false) {
  const { rows } = await db.query(
    "SELECT id, conversation_id, sender_id, is_deleted FROM messages WHERE id = $1",
    [messageId]
  );
  if (!rows.length) {
    throw notFound("Message not found");
  }
  const msg = rows[0];

  if (msg.sender_id !== userId && !isAdmin) {
    throw forbidden("You are not authorized to delete this message");
  }

  await db.query(
    `UPDATE messages 
     SET is_deleted = true, content = 'This message was deleted', attachments = '[]'::jsonb, updated_at = NOW() 
     WHERE id = $1`,
    [messageId]
  );

  const payload = {
    messageId,
    conversationId: msg.conversation_id,
  };

  emitToConversation(msg.conversation_id, "message:deleted", payload);
  return { success: true, messageId };
}

/**
 * Mark conversation as read for a user
 */
async function markAsRead(conversationId, userId) {
  const now = new Date().toISOString();

  // Reset unread count for current user
  await db.query(
    `UPDATE conversation_participants 
     SET unread_count = 0, last_read_at = NOW() 
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );

  // Mark all unread receipts
  await db.query(
    `UPDATE message_receipts mr
     SET status = 'read', updated_at = NOW()
     FROM messages m
     WHERE mr.message_id = m.id 
       AND m.conversation_id = $1 
       AND mr.user_id = $2 
       AND mr.status != 'read'`,
    [conversationId, userId]
  );

  // Update messages status
  await db.query(
    `UPDATE messages 
     SET status = 'read' 
     WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
    [conversationId, userId]
  );

  emitToConversation(conversationId, "message:read", {
    conversationId,
    userId,
    readAt: now,
  });

  return { success: true, conversationId, readAt: now };
}

/**
 * Toggle participant settings: pin, archive, mute
 */
async function toggleSetting(conversationId, userId, { isPinned, isArchived, isMuted }) {
  const updates = [];
  const params = [conversationId, userId];

  if (typeof isPinned === "boolean") {
    params.push(isPinned);
    updates.push(`is_pinned = $${params.length}`);
  }
  if (typeof isArchived === "boolean") {
    params.push(isArchived);
    updates.push(`is_archived = $${params.length}`);
  }
  if (typeof isMuted === "boolean") {
    params.push(isMuted);
    updates.push(`is_muted = $${params.length}`);
  }

  if (!updates.length) {
    throw badRequest("No valid settings to update");
  }

  const { rows } = await db.query(
    `UPDATE conversation_participants 
     SET ${updates.join(", ")} 
     WHERE conversation_id = $1 AND user_id = $2 
     RETURNING is_pinned, is_archived, is_muted`,
    params
  );

  if (!rows.length) {
    throw notFound("Conversation not found or you are not a participant");
  }

  return {
    conversationId,
    isPinned: rows[0].is_pinned,
    isArchived: rows[0].is_archived,
    isMuted: rows[0].is_muted,
  };
}

/**
 * Block a user
 */
async function blockUser(blockerId, targetUserId, reason = null) {
  if (blockerId === targetUserId) {
    throw badRequest("You cannot block yourself");
  }

  await db.query(
    `INSERT INTO user_blocks (blocker_id, blocked_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = EXCLUDED.reason`,
    [blockerId, targetUserId, reason]
  );

  return { success: true, blockedUserId: targetUserId };
}

/**
 * Unblock a user
 */
async function unblockUser(blockerId, targetUserId) {
  await db.query(
    `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, targetUserId]
  );
  return { success: true, unblockedUserId: targetUserId };
}

/**
 * Get blocked users list
 */
async function getBlockedUsers(userId) {
  const { rows } = await db.query(
    `SELECT ub.blocked_id as id, ub.reason, ub.created_at, u.name, u.avatar_url, u.role
     FROM user_blocks ub
     JOIN users u ON u.id = ub.blocked_id
     WHERE ub.blocker_id = $1
     ORDER BY ub.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Report a user / message
 */
async function reportUser(reporterId, universityId, { targetUserId, conversationId, messageId, reason, details }) {
  if (reporterId === targetUserId) {
    throw badRequest("You cannot report yourself");
  }

  const detailObj = {
    conversationId,
    messageId,
    notes: details || null,
  };

  const { rows } = await db.query(
    `INSERT INTO reports (reporter_id, target_id, target_type, university_id, reason, details, status)
     VALUES ($1, $2, 'user', $3, $4, $5, 'pending')
     RETURNING id, created_at`,
    [reporterId, targetUserId, universityId, reason, JSON.stringify(detailObj)]
  );

  return { success: true, reportId: rows[0].id };
}

/**
 * Total unread messages count for badges
 */
async function getUnreadCount(userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(unread_count), 0)::int as total
     FROM conversation_participants cp
     JOIN conversations c ON c.id = cp.conversation_id
     WHERE cp.user_id = $1 AND cp.is_archived = false`,
    [userId]
  );
  return { total: rows[0]?.total || 0 };
}

module.exports = {
  getConversations,
  getOrCreateConversation,
  getConversationById,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  toggleSetting,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  getUnreadCount,
};
