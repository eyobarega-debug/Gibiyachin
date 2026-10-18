// Shared labels/helpers for the Super Admin console. Kept in a .js module so
// Fast Refresh doesn't complain about a component file exporting constants.

export const ROLE_LABEL = {
  student: "Student",
  merchant: "Merchant",
  organizer: "Event Organizer",
  admin: "Campus Admin",
  super_admin: "Super Admin",
};

export const ROLE_TONE = {
  student: "slate",
  merchant: "info",
  organizer: "accent",
  admin: "warn",
  super_admin: "danger",
};

// Roles a Super Admin may assign through PATCH /api/admin/users/:id.
// "admin" is deliberately excluded — the backend requires POST /api/super/admins/promote.
export const ASSIGNABLE_ROLES = ["student", "merchant", "organizer"];

export const USER_ROLE_FILTERS = [
  { value: "", label: "All roles" },
  { value: "student", label: "Students" },
  { value: "merchant", label: "Merchants" },
  { value: "organizer", label: "Organizers" },
  { value: "admin", label: "Campus Admins" },
  { value: "super_admin", label: "Super Admins" },
];

// Mirrors order_status values in backend/src/services/orderStatus.js
export const ORDER_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "confirmed", label: "Paid" },
  { value: "ready", label: "Ready for pickup" },
  { value: "completed", label: "Completed" },
  { value: "cancellation_requested", label: "Cancellation requested" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

export const ORDER_STATUS_LABEL = {
  pending_payment: "Pending payment",
  confirmed: "Paid",
  ready: "Ready for pickup",
  completed: "Completed",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const ORDER_STATUS_TONE = {
  pending_payment: "warn",
  confirmed: "accent",
  ready: "info",
  completed: "ok",
  cancellation_requested: "warn",
  cancelled: "danger",
  refunded: "slate",
};

export const PAYMENT_STATUS_TONE = {
  pending: "warn",
  under_review: "info",
  confirmed: "ok",
  failed: "danger",
  refunded: "slate",
  cancelled: "danger",
};

export const VERIFICATION_STATUS_TONE = {
  pending: "warn",
  approved: "ok",
  rejected: "danger",
};

// Feature flags enforced by backend useFeature() (backend/src/app.js).
export const FEATURE_FLAGS = [
  { key: "p2p", label: "P2P Marketplace" },
  { key: "rentals", label: "Rentals" },
  { key: "events", label: "Events & Ticketing" },
];

export const UNIVERSITY_STATUS_TONE = {
  active: "ok",
  suspended: "danger",
  archived: "slate",
};

export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export function shortId(id) {
  return String(id || "").slice(0, 8);
}

export function humanize(value) {
  if (!value) return "—";
  return String(value).replaceAll("_", " ");
}
