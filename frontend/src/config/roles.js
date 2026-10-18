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
  // Public browsing
  { key: "home", label: "Home", to: "/", icon: "home", section: "Browse" },
  { key: "marketplace", label: "Marketplace", to: "/marketplace", icon: "marketplace", section: "Browse" },
  { key: "listings", label: "P2P Market", to: "/listings", icon: "listings", section: "Browse" },
  { key: "rentals", label: "Rentals", to: "/rentals", icon: "rentals", section: "Browse" },
  { key: "events", label: "Events", to: "/events", icon: "events", section: "Browse" },

  // Personal activity
  { key: "orders", label: "My Orders", to: "/orders", icon: "orders", section: "My Activity", roles: ["student", ...ADMIN_ROLES] },
  { key: "tickets", label: "My Tickets", to: "/tickets", icon: "tickets", section: "My Activity", roles: ["student", ...ADMIN_ROLES] },
  { key: "favorites", label: "Favorites", to: "/favorites", icon: "favorites", section: "My Activity", roles: ["student", "merchant", "organizer", ...ADMIN_ROLES] },
  { key: "payments", label: "Payments", to: "/payment-approvals", icon: "payments", section: "My Activity", roles: ["student", "merchant", "organizer", ...ADMIN_ROLES] },
  { key: "commissions", label: "Commissions", to: "/commissions", adminTo: "/admin/commissions", icon: "commission", section: "My Activity", roles: ["student", "merchant", ...ADMIN_ROLES] },

  // Merchant workspace
  { key: "merchant", label: "Merchant Dashboard", to: "/merchant", icon: "store", section: "Merchant", roles: ["merchant", ...ADMIN_ROLES] },

  // Organizer workspace
  { key: "organizer", label: "Organizer", to: "/organizer", icon: "events", section: "Organizer", roles: ["organizer", ...ADMIN_ROLES] },

  // Administration
  { key: "verifyCampus", label: "Verification", to: "/verify", icon: "verification", section: "Account", roles: ["student", "merchant", "organizer", ...ADMIN_ROLES] },

  // Admin-only
  { key: "admin", label: "Admin", to: "/admin", icon: "admin", section: "Admin", roles: ADMIN_ROLES },
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
