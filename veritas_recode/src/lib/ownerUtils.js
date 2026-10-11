import { backend } from "@/api/backendClient";

export function licenseStatus(inst) {
  if (!inst) return { key: "unknown", label: "—", color: "bg-muted/30 text-muted-foreground border-border" };
  if (inst.status === "suspended") return { key: "suspended", label: "Suspended", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  if (inst.status === "pending") return { key: "pending", label: "Pending", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
  if (inst.status === "rejected") return { key: "rejected", label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/30" };
  if (inst.status === "approved") {
    if (inst.subscription_expiry) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const exp = new Date(inst.subscription_expiry); exp.setHours(0, 0, 0, 0);
      if (exp < today) return { key: "expired", label: "Expired", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
    }
    return { key: "active", label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
  }
  return { key: inst.status, label: inst.status, color: "bg-muted/30 text-muted-foreground border-border" };
}

export function isExpiringSoon(inst, days = 30) {
  if (!inst || inst.status !== "approved" || !inst.subscription_expiry) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(inst.subscription_expiry); exp.setHours(0, 0, 0, 0);
  const diff = (exp - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

export function addMonths(dateStr, months) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function fmtDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

export async function writeAuditLog({ action, target_id, target_name, description }) {
  try {
    const me = await backend.auth.me();
    await backend.entities.AuditLog.create({
      action,
      actor_name: me.full_name || me.email,
      actor_id: me.id,
      target_type: "institution",
      target_id: target_id || "",
      target_name: target_name || "",
      description: description || "",
    });
  } catch (e) {
    console.warn("Audit log failed:", e);
  }
}