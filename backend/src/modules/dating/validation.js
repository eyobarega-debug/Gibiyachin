const { z } = require("zod");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().trim().regex(UUID_REGEX, "Must be a valid UUID");

const safePhotoUrl = z
  .union([
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
    z.null(),
  ])
  .optional()
  .nullable();

function calculateAge(birthDateStr) {
  const today = new Date();
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return -1;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const profileSchema = z
  .object({
    birthDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be in YYYY-MM-DD format"),
    adultConfirmed: z.boolean().refine((val) => val === true, {
      message: "You must confirm that you are at least 18 years of age",
    }),
    displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(100),
    gender: z
      .enum(["man", "woman", "non_binary", "other", "male", "female"])
      .transform((g) => (g === "male" ? "man" : g === "female" ? "woman" : g)),
    bio: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .default("")
      .transform((val) => val || ""),
    department: z.string().trim().max(120).optional().nullable(),
    academicYear: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const num = parseInt(String(val).replace(/\D/g, ""), 10);
        return isNaN(num) || num < 1 || num > 7 ? null : num;
      }),
    interests: z.array(z.string().trim().max(50)).max(20).optional().default([]),
    hobbies: z.array(z.string().trim().max(50)).max(20).optional().default([]),
    favoriteMusic: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable()
      .transform((v) => (Array.isArray(v) ? v.join(", ") : v || null)),
    favoriteMovies: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable()
      .transform((v) => (Array.isArray(v) ? v.join(", ") : v || null)),
    favoriteActivities: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable()
      .transform((v) => (Array.isArray(v) ? v.join(", ") : v || null)),
    languages: z.array(z.string().trim().max(50)).max(10).optional().default([]),
    avatarUrl: safePhotoUrl.optional().nullable(),
    photos: z.array(safePhotoUrl).max(6).optional().default([]),
    privacySettings: z
      .object({
        show_age: z.boolean().optional().default(true),
        show_department: z.boolean().optional().default(true),
        show_year: z.boolean().optional().default(true),
        hideMajor: z.boolean().optional(),
        incognito: z.boolean().optional(),
      })
      .optional()
      .default({ show_age: true, show_department: true, show_year: true }),
  })
  .refine(
    (data) => {
      const age = calculateAge(data.birthDate);
      return age >= 18;
    },
    {
      message: "Age requirement not met: you must be at least 18 years old to use Gibiyachin Connect",
      path: ["birthDate"],
    }
  );

const preferencesSchema = z
  .object({
    minAge: z.coerce.number().int().min(18, "Minimum age must be at least 18").max(100).default(18),
    maxAge: z.coerce.number().int().min(18).max(100).default(35),
    interestedIn: z
      .union([z.string(), z.array(z.string())])
      .transform((val) => {
        if (Array.isArray(val)) return val;
        if (val === "everyone" || val === "all") return ["all"];
        return [val];
      })
      .default(["all"]),
    sameUniversityOnly: z.boolean().default(true),
    preferredInterests: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  })
  .refine((data) => data.maxAge >= data.minAge, {
    message: "Maximum age must be greater than or equal to minimum age",
    path: ["maxAge"],
  });

const swipeSchema = z.object({
  targetId: uuidSchema,
  action: z.enum(["like", "pass"]),
});

const statusSchema = z.object({
  status: z
    .enum(["active", "paused", "hidden", "deactivated", "deleted"])
    .transform((s) => (s === "deleted" ? "deactivated" : s)),
});

const reportDatingSchema = z.object({
  targetId: uuidSchema,
  category: z
    .enum([
      "inappropriate_content",
      "harassment",
      "impersonation",
      "underage",
      "spam",
      "other",
    ])
    .optional(),
  reason: z.string().trim().max(100).optional(),
  details: z.string().trim().max(1000).optional().nullable(),
});

module.exports = {
  calculateAge,
  profileSchema,
  preferencesSchema,
  swipeSchema,
  statusSchema,
  reportDatingSchema,
};
