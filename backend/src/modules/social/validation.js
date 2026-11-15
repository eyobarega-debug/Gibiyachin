const { z } = require("zod");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().trim().regex(UUID_REGEX, "Must be a valid UUID");

const safePhotoUrl = z.union([
  z.string().trim().refine((val) => {
    try {
      const u = new URL(val);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (_) {
      return false;
    }
  }, { message: "Must be a valid http or https URL" }),
  z.string().regex(/^\/?(uploads|images|assets|avatars)\/[a-zA-Z0-9_\-./]+$/i, {
    message: "Must be a valid upload or asset path",
  }),
  z.string().regex(/^\/[a-zA-Z0-9_\-.]+\.(jpg|jpeg|png|webp|gif|svg)$/i, {
    message: "Must be a valid image path",
  }),
  z.literal(""),
]);

const POST_CATEGORIES = [
  // Gibiyachin Confessions Categories
  "love",
  "love & relationships",
  "Love & Relationships",
  "Love & Relationships ❤️",
  "funny",
  "funny confessions",
  "Funny Confessions",
  "Funny Confessions 😂",
  "university_life",
  "university life",
  "University Life",
  "University Life 🎓",
  "heartbreak",
  "Heartbreak",
  "Heartbreak 💔",
  "secrets",
  "Secrets",
  "Secrets 🤫",
  "rants",
  "rants & frustrations",
  "Rants & Frustrations",
  "Rants & Frustrations 😭",
  "random",
  "random thoughts",
  "Random Thoughts",
  "Random Thoughts 💭",
  "hot_takes",
  "hot takes",
  "Hot Takes",
  "Hot Takes 🔥",
  "academic_life",
  "academic life",
  "Academic Life",
  "Academic Life 📚",
  "other",
  "Other",
  // Legacy categories
  "general",
  "academic",
  "tech",
  "technology",
  "education",
  "entertainment",
  "sports",
  "business",
  "events",
  "questions",
  "campus_life",
  "campus life",
  "announcements",
  "creative",
  "gaming",
  "career",
  "General",
  "Technology",
  "Education",
  "Entertainment",
  "Sports",
  "Business",
  "Events",
  "Questions",
  "Campus Life",
  "Announcements",
];

const createPostSchema = z.object({
  content: z.string().trim().min(1, "Post content cannot be empty").max(5000, "Content cannot exceed 5000 characters"),
  images: z.array(safePhotoUrl).max(6, "Cannot upload more than 6 images").optional().default([]),
  mediaUrls: z.array(safePhotoUrl).max(6).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  location: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(50).optional().default("general"),
  postType: z.enum(["post", "poll", "announcement", "question"]).optional().default("post"),
  audience: z.enum(["university", "campus", "community", "private", "public"]).optional().default("university"),
  communityId: uuidSchema.optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  isOfficial: z.boolean().optional(),
  is_official: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  // Poll data if postType === 'poll'
  poll: z
    .object({
      question: z.string().trim().min(2, "Poll question must be at least 2 characters").max(300),
      options: z
        .array(z.string().trim().min(1, "Option cannot be empty").max(120))
        .min(2, "Poll must have at least 2 options")
        .max(6, "Poll cannot have more than 6 options"),
      expiresAt: z.string().datetime().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const updatePostSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  images: z.array(safePhotoUrl).max(6).optional(),
  mediaUrls: z.array(safePhotoUrl).max(6).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  location: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(50).optional(),
  isPinned: z.boolean().optional(),
});

const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
  parentCommentId: uuidSchema.optional().nullable(),
});

const updateCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

const votePollSchema = z.object({
  optionId: uuidSchema,
});

const createCommunitySchema = z.object({
  name: z.string().trim().min(2, "Community name must be at least 2 characters").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().trim().max(1000).optional().nullable().default(""),
  category: z.string().trim().max(50).optional().default("general"),
  type: z.enum(["public", "private", "official"]).optional().default("public"),
  avatarUrl: safePhotoUrl.optional().nullable(),
  bannerUrl: safePhotoUrl.optional().nullable(),
  rules: z.string().trim().max(2000).optional().nullable(),
});

const updateCommunitySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(50).optional(),
  avatarUrl: safePhotoUrl.optional().nullable(),
  bannerUrl: safePhotoUrl.optional().nullable(),
  rules: z.string().trim().max(2000).optional().nullable(),
  type: z.enum(["public", "private", "official"]).optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["moderator", "member"]),
});

const reviewJoinRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

const createReportSchema = z.object({
  targetType: z.enum(["post", "comment", "community", "image"]).optional(),
  targetId: uuidSchema.optional(),
  category: z.string().trim().max(100).optional(),
  reasonCategory: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable().default(""),
  reasonDetails: z.string().trim().max(1000).optional().nullable(),
});

const feedQuerySchema = z.object({
  tab: z.enum([
    "for_you",
    "following",
    "communities",
    "trending",
    "latest",
    "recent",
    "saved",
    "most_liked",
    "top",
    "most_discussed",
    "discussed",
    "announcements",
    "my_posts",
    "mine",
  ]).optional().default("latest"),
  category: z.string().trim().optional(),
  communityId: uuidSchema.optional(),
  authorId: uuidSchema.optional(),
  tag: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  search: z.string().trim().max(100).optional(),
});

const auditDisclosureSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(10, "A detailed explanation (at least 10 characters) is required for identity disclosure audit")
    .max(1000),
});

module.exports = {
  uuidSchema,
  safePhotoUrl,
  POST_CATEGORIES,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  votePollSchema,
  createCommunitySchema,
  updateCommunitySchema,
  updateMemberRoleSchema,
  reviewJoinRequestSchema,
  createReportSchema,
  feedQuerySchema,
  auditDisclosureSchema,
};
