export const ROLES = {
  admin: { label: "System Owner", description: "Owns the platform — manages all institutions, licenses & approvals", modules: ["*"] },
  institution_admin: { label: "Admin", description: "Full access to your institution's data", modules: ["*"] },
  accountant: { label: "Accountant", description: "Accounting & payments", modules: ["dashboard", "accounting", "payments", "repayments", "dividends", "banking"] },
  front_office: { label: "Front Office", description: "Members, loans & shares", modules: ["dashboard", "members", "shares", "loans", "applications", "repayments", "upload-loans", "payments", "banking"] },
  member: { label: "Member", description: "Member portal access", modules: [] },
};

export const MODULE_KEYS = {
  "/dashboard": "dashboard",
  "/members": "members",
  "/shares": "shares",
  "/loans": "loans",
  "/applications": "applications",
  "/repayments": "repayments",
  "/payments": "payments",
  "/accounting": "accounting",
  "/dividends": "dividends",
  "/banking": "banking",
  "/upload-loans": "upload-loans",
  "/approvals": "approvals",
};

export function canAccessModule(role, moduleKey) {
  const r = ROLES[role];
  if (!r) return false;
  if (r.modules.includes("*")) return true;
  return r.modules.includes(moduleKey);
}

export function roleLabel(role) {
  return ROLES[role]?.label || role;
}

export function isPlatformAdmin(user) {
  return !!user && (user.role === "admin" || user.is_platform_admin === true);
}

export function isSystemOwner(user) {
  return isPlatformAdmin(user);
}