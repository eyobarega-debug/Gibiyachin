const { z } = require("zod");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidSchema = z.string().trim().regex(UUID_REGEX, "Must be a valid UUID");

const safeAttachmentUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (val) => {
      if (!val) return false;
      if (/^\/uploads\/[a-zA-Z0-9_\-\.]+\.(jpg|jpeg|png|webp|gif|pdf|doc|docx|txt)$/i.test(val)) return true;
      try {
        const u = new URL(val);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch (_) {
        return false;
      }
    },
    { message: "Attachment URL must be a valid upload path or http/https URL" }
  );

const attachmentObjectSchema = z.object({
  url: safeAttachmentUrl,
  name: z.string().trim().max(255).optional(),
  type: z.string().trim().max(100).optional(),
  size: z.number().nonnegative().optional(),
});

const createConversationSchema = z.object({
  recipientId: uuidSchema,
  type: z.enum(["general", "marketplace", "rental", "lost_found", "dating"]).default("general"),
  contextType: z.string().trim().max(64).optional().nullable(),
  contextId: uuidSchema.optional().nullable(),
  contextData: z.record(z.any()).optional().nullable(),
});

const sendMessageSchema = z
  .object({
    content: z.string().max(5000).optional().nullable(),
    attachments: z.array(attachmentObjectSchema).max(10).optional().default([]),
    replyToId: uuidSchema.optional().nullable(),
  })
  .refine(
    (data) => {
      const hasContent = typeof data.content === "string" && data.content.trim().length > 0;
      const hasAttachments = Array.isArray(data.attachments) && data.attachments.length > 0;
      return hasContent || hasAttachments;
    },
    { message: "Message must contain either text content or at least one attachment" }
  );

const editMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content cannot be empty").max(5000),
});

const queryConversationsSchema = z.object({
  type: z.enum(["general", "marketplace", "rental", "lost_found", "dating", "all"]).optional(),
  search: z.string().trim().max(100).optional(),
  archived: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((val) => val === true || val === "true"),
});

const queryMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().trim().optional(),
});

const toggleSettingSchema = z.object({
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isMuted: z.boolean().optional(),
});

const blockUserSchema = z.object({
  targetUserId: uuidSchema,
  reason: z.string().trim().max(500).optional().nullable(),
});

const reportUserSchema = z.object({
  targetUserId: uuidSchema,
  conversationId: uuidSchema.optional().nullable(),
  messageId: uuidSchema.optional().nullable(),
  reason: z.string().trim().min(2, "Reason is required").max(100),
  details: z.string().trim().max(1000).optional().nullable(),
});

module.exports = {
  createConversationSchema,
  sendMessageSchema,
  editMessageSchema,
  queryConversationsSchema,
  queryMessagesSchema,
  toggleSettingSchema,
  blockUserSchema,
  reportUserSchema,
};
