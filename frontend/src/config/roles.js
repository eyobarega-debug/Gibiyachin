// Single source of truth for which tabs/routes each role can see.
// AppLayout reads from here, so adding a tab means editing ONE place.
//
// Roles: student | merchant | organizer | admin | super_admin
// Admins (and super admins) see every tab.

export const ADMIN_ROLES = ["admin", "super_admin"];
export const ALL_ROLES = ["student", "merchant", "organizer", "admin", "super_admin"];

// roles: who sees the tab.  null/undefined = everyone (even logged-out visitors).
// `section` groups the sidebar; `icon` maps to the shared Icon set.
export const TABS = [
  // Main browsing
  { key: "home", label: "Home", to: "/", icon: "home", section: "Main" },
  { key: "marketplace", label: "Marketplace", to: "/marketplace", icon: "marketplace", section: "Main" },
  { key: "events", label: "Events", to: "/events", icon: "events", section: "Main" },
  { key: "rentals", label: "Rentals", to: "/rentals", icon: "rentals", section: "Main" },
  { key: "listings", label: "P2P Market", to: "/listings", icon: "listings", section: "Main" },

  // Personal activity (Students / Common)
  { key: "orders", label: "My Orders", to: "/orders", icon: "orders", section: "My Activity", roles: ["student"] },
  { key: "tickets", label: "My Tickets", to: "/tickets", icon: "tickets", section: "My Activity", roles: ["student"] },
  { key: "favorites", label: "Favorites", to: "/favorites", icon: "favorites", section: "My Activity", roles: ["student"] },
  { key: "payments_student", label: "Payments", to: "/payment-approvals", icon: "payments", section: "My Activity", roles: ["student"] },

  // Merchant Workspace
  { key: "merchant_dashboard", label: "Dashboard", to: "/merchant", icon: "dashboard", section: "Merchant", roles: ["merchant"] },
  { key: "merchant_products", label: "Products", to: "/merchant", icon: "products", section: "Merchant", roles: ["merchant"] },
  { key: "merchant_orders", label: "Orders", to: "/orders", icon: "orders", section: "Merchant", roles: ["merchant"] },
  { key: "merchant_sales", label: "Sales & Fees", to: "/commissions", icon: "sales", section: "Merchant", roles: ["merchant"] },
  { key: "merchant_verify", label: "Verification", to: "/verify", icon: "verification", section: "Merchant", roles: ["merchant"] },

  // Organizer Workspace
  { key: "organizer_dashboard", label: "Dashboard", to: "/organizer", icon: "dashboard", section: "Organizer", roles: ["organizer"] },
  { key: "organizer_events", label: "Events", to: "/organizer", icon: "events", section: "Organizer", roles: ["organizer"] },
  { key: "organizer_tickets", label: "Tickets", to: "/tickets", icon: "tickets", section: "Organizer", roles: ["organizer"] },
  { key: "organizer_scanner", label: "Gate Scanner", to: "/tickets/verify", icon: "qr", section: "Organizer", roles: ["organizer"] },
  { key: "organizer_payments", label: "Payments", to: "/payment-approvals", icon: "payments", section: "Organizer", roles: ["organizer"] },

  // Admin Workspace
  { key: "admin_dashboard", label: "Dashboard", to: "/admin", icon: "dashboard", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_users", label: "Users", to: "/admin", icon: "user", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_verify", label: "Verification", to: "/admin", icon: "verification", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_payments", label: "Payments", to: "/payment-approvals", icon: "payments", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_orders", label: "Orders", to: "/orders", icon: "orders", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_events", label: "Events", to: "/events", icon: "events", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_tickets", label: "Tickets", to: "/tickets", icon: "tickets", section: "Admin", roles: ADMIN_ROLES },
  { key: "admin_reports", label: "Reports & Fees", to: "/admin/commissions", icon: "reports", section: "Admin", roles: ADMIN_ROLES },
];

export function canSee(tab, user) {
  if (!tab.roles) return true;
  if (!user) return false;
  return tab.roles.includes(user.role);
}

export function visibleTabs(user) {
  return TABS.filter((t) => canSee(t, user)).map((t) => ({
    ...t,
    to: user && ADMIN_ROLES.includes(user.role) && t.adminTo ? t.adminTo : t.to,
  }));
}

// Route-guard helper: rolesFor("orders") -> ["student","admin","super_admin"]
export function rolesFor(key) {
  return TABS.find((t) => t.key === key)?.roles;
}
