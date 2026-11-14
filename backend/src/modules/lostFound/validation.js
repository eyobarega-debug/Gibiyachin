const { z } = require("zod");

const LOST_FOUND_CATEGORIES = [
  "Student ID Cards",
  "Electronics",
  "Phones",
  "Laptops",
  "Bags and Backpacks",
  "Books and Notes",
  "Wallets",
  "Keys",
  "Clothing",
  "Accessories",
  "Other",
];

const safeImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (val) => {
      if (!val) return true;
      if (/^\/uploads\/[a-zA-Z0-9_\-\.]+\.(jpg|jpeg|png|webp|gif)$/i.test(val)) return true;
      try {
        const u = new URL(val);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch (_) {
        return false;
      }
    },
    { message: "Image URL must be a valid upload path (/uploads/...) or safe http/https URL" }
  );

const createItemRawSchema = z.object({
  type: z.enum(["lost", "found"]),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(150),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5, "Description must be at least 5 characters").max(3000),
  dateOccurred: z.string().trim().min(4, "Approximate date is required"),
  location: z.string().trim().min(2, "Location is required").max(200),
  images: z.array(safeImageUrl).max(6).optional().default([]),
  brand: z.string().trim().max(100).optional().nullable(),
  color: z.string().trim().max(100).optional().nullable(),
  identifyingCharacteristics: z.string().trim().max(1000).optional().nullable(),
  rewardAmount: z.coerce.number().nonnegative().optional().default(0),
  privateDetails: z.string().trim().max(2000).optional().nullable(),
});

const createItemSchema = z.preprocess((val) => {
  if (val && typeof val === "object") {
    return {
      ...val,
      dateOccurred: val.dateOccurred || val.date_occurred || val.date_incident,
      rewardAmount: val.rewardAmount !== undefined ? val.rewardAmount : val.reward_amount,
      privateDetails: val.privateDetails !== undefined ? val.privateDetails : val.private_details,
      identifyingCharacteristics:
        val.identifyingCharacteristics !== undefined
          ? val.identifyingCharacteristics
          : val.identifying_characteristics,
    };
  }
  return val;
}, createItemRawSchema);

const updateItemRawSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(5).max(3000).optional(),
  dateOccurred: z.string().trim().min(4).optional(),
  location: z.string().trim().min(2).max(200).optional(),
  images: z.array(safeImageUrl).max(6).optional(),
  brand: z.string().trim().max(100).optional().nullable(),
  color: z.string().trim().max(100).optional().nullable(),
  identifyingCharacteristics: z.string().trim().max(1000).optional().nullable(),
  rewardAmount: z.coerce.number().nonnegative().optional(),
  privateDetails: z.string().trim().max(2000).optional().nullable(),
  status: z
    .enum(["open", "matched", "claim_pending", "awaiting_handover", "returned", "closed", "removed"])
    .optional(),
});

const updateItemSchema = z.preprocess((val) => {
  if (val && typeof val === "object") {
    return {
      ...val,
      dateOccurred: val.dateOccurred || val.date_occurred || val.date_incident,
      rewardAmount: val.rewardAmount !== undefined ? val.rewardAmount : val.reward_amount,
      privateDetails: val.privateDetails !== undefined ? val.privateDetails : val.private_details,
      identifyingCharacteristics:
        val.identifyingCharacteristics !== undefined
          ? val.identifyingCharacteristics
          : val.identifying_characteristics,
    };
  }
  return val;
}, updateItemRawSchema);

const queryItemsSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  type: z.enum(["all", "lost", "found"]).optional().default("all"),
  category: z.string().trim().max(100).optional().default("all"),
  status: z
    .enum(["all", "open", "matched", "claim_pending", "awaiting_handover", "returned", "closed"])
    .optional()
    .default("all"),
  location: z.string().trim().max(200).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["newest", "oldest", "reward_desc"]).optional().default("newest"),
});

const claimRawSchema = z.object({
  message: z.string().trim().max(2000).optional().default("I would like to verify ownership of this item."),
  privateProof: z.string().trim().min(5, "Private identifying proof is required").max(3000),
  evidenceImages: z.array(safeImageUrl).max(6).optional().default([]),
  contactPhone: z.string().trim().max(50).optional().nullable(),
});

const claimSchema = z.preprocess((val) => {
  if (val && typeof val === "object") {
    return {
      ...val,
      message: val.message || val.private_proof || val.privateProof || "I would like to verify ownership of this item.",
      privateProof: val.privateProof || val.private_proof,
      evidenceImages: val.evidenceImages || val.evidence_images || [],
      contactPhone: val.contactPhone || val.contact_phone || null,
    };
  }
  return val;
}, claimRawSchema);

const reviewClaimRawSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().trim().max(1000).optional().nullable(),
});

const reviewClaimSchema = z.preprocess((val) => {
  if (val && typeof val === "object") {
    return {
      ...val,
      action: val.action || val.decision,
      reviewNotes:
        val.reviewNotes !== undefined
          ? val.reviewNotes
          : val.rejection_reason !== undefined
          ? val.rejection_reason
          : val.review_notes,
    };
  }
  return val;
}, reviewClaimRawSchema);

const disputeClaimSchema = z.object({
  reason: z.string().trim().min(5, "Dispute reason must be at least 5 characters").max(2000),
});

const adminModerateSchema = z.object({
  action: z.enum(["remove", "restore", "close", "resolve_dispute"]),
  reason: z.string().trim().max(1000).optional(),
  resolution: z.string().trim().max(1000).optional(),
});

module.exports = {
  LOST_FOUND_CATEGORIES,
  createItemSchema,
  updateItemSchema,
  queryItemsSchema,
  claimSchema,
  reviewClaimSchema,
  disputeClaimSchema,
  adminModerateSchema,
};
