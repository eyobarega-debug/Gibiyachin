import { client } from "../api/client";

/**
 * Allowlist of valid application route prefixes.
 * Prevents open redirect attacks or arbitrary URL schemes.
 */
export const ALLOWED_ROUTE_PREFIXES = [
  "/orders",
  "/merchant",
  "/merchant-apply",
  "/payment-approvals",
  "/pay/manual",
  "/tickets",
  "/events",
  "/listings",
  "/rentals",
  "/admin",
  "/super-admin",
  "/commissions",
  "/admin/commissions",
  "/profile",
  "/verify",
  "/marketplace",
  "/seller",
  "/organizer",
  "/organizer-apply",
  "/notifications",
];

/**
 * Check if a URL path is safe to navigate to internally.
 */
export function isSafeInternalRoute(url) {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();

  // Must begin with a single slash, not a double slash or protocol
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;

  // Extract pathname without query string or hash
  const pathname = trimmed.split("?")[0].split("#")[0];

  return ALLOWED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/**
 * Resolves the destination route for any notification.
 * Uses explicitly stored target metadata if present and valid;
 * otherwise gracefully derives the destination from the notification type.
 */
export function resolveNotificationTarget(notification) {
  if (!notification) return "/notifications";

  const explicitRoute =
    notification.target_route ||
    notification.targetRoute ||
    notification.target?.route;

  if (explicitRoute && isSafeInternalRoute(explicitRoute)) {
    return explicitRoute;
  }

  // Fallback map based on notification type
  const type = notification.type;
  switch (type) {
    case "order_update":
      return "/orders";
    case "payment_update":
      return "/payment-approvals";
    case "ticket_update":
      return "/tickets";
    case "rental_update":
      return "/rentals/mine";
    case "p2p_request":
      return "/listings";
    case "event_review":
      return "/organizer";
    case "merchant_application":
      return "/admin?tab=Merchants";
    case "merchant_decision":
      return "/merchant";
    case "organizer_application":
      return "/admin?tab=Organizers";
    case "organizer_decision":
      return "/organizer";
    case "verification_request":
      return "/admin?tab=Verifications";
    case "verification_submitted":
    case "verification_approved":
    case "verification_rejected":
      return "/verify";
    case "report":
      return "/admin?tab=Reports";
    case "commission_update":
      return "/commissions";
    case "payout_update":
      return "/organizer";
    default:
      return "/notifications";
  }
}

/**
 * Resolves the associated entity metadata (type & id) from a notification.
 */
export function getNotificationEntity(notification) {
  if (!notification) return { type: null, id: null };
  const type =
    notification.target_entity_type ||
    notification.targetEntityType ||
    notification.target?.entityType ||
    null;
  const id =
    notification.target_entity_id ||
    notification.targetEntityId ||
    notification.target?.entityId ||
    null;
  return { type, id };
}

// In-flight click tracker to debounce duplicate user taps
const pendingClicks = new Set();

/**
 * Actionable notification click handler:
 * 1. Debounces duplicate taps.
 * 2. Marks notification as read in backend and invokes onMarkRead callback.
 * 3. Resolves allowlisted destination URL.
 * 4. Navigates cleanly without page reload.
 */
export async function handleNotificationClick(
  notification,
  { navigate, onMarkRead, currentPath } = {}
) {
  if (!notification?.id) return;

  const key = notification.id;
  if (pendingClicks.has(key)) return; // Debounce rapid double-clicks
  pendingClicks.add(key);
  setTimeout(() => pendingClicks.delete(key), 800);

  // 1. Mark as read if not already read
  if (!notification.read_at) {
    try {
      client.patch(`/notifications/${notification.id}/read`).catch(() => {});
      if (typeof onMarkRead === "function") {
        onMarkRead(notification.id);
      }
    } catch {
      // Non-fatal if read status update fails
    }
  }

  // 2. Resolve destination
  const targetRoute = resolveNotificationTarget(notification);

  // 3. Navigate if a navigate function is provided and route differs
  if (typeof navigate === "function") {
    if (targetRoute !== currentPath) {
      navigate(targetRoute);
    }
  }

  return targetRoute;
}

