import { backend } from "@/api/backendClient";

// Multi-tenant scoping: resolves the institution of the currently signed-in
// console user, then filters loaded records so every institution's console only
// ever shows its own data. The platform owner (no linked institution) sees everything.

let cachedInstId;
let inflight = null;

export function getMyInstitutionId() {
  if (cachedInstId !== undefined) return Promise.resolve(cachedInstId);
  if (!inflight) {
    inflight = (async () => {
      try {
        const me = await backend.auth.me();
        if (me?.institution_id) return me.institution_id;
        // Platform owner manages every institution — unscoped view
        if (me && (me.role === "admin" || me.is_platform_admin === true)) return null;
        // Fallback for admin users whose profile lacks the link
        const insts = await backend.entities.Institution.list().catch(() => []);
        const mine = insts.find((i) => i.admin_user_id === me?.id);
        return mine?.id || null;
      } catch {
        return null;
      }
    })().then((id) => {
      cachedInstId = id;
      inflight = null;
      return id;
    });
  }
  return inflight;
}

// Filter an array of records down to the current user's institution.
export async function scoped(records) {
  const instId = await getMyInstitutionId();
  if (!instId) return records || [];
  return (records || []).filter((r) => r.institution_id === instId);
}

// Institution id to stamp on newly created records.
export async function institutionIdForCreate() {
  return (await getMyInstitutionId()) || "";
}