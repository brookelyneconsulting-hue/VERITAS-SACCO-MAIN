import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";

// Displayed instead of the amount when bank balances are hidden in the admin console.
export const MASKED_BALANCE = "••••••";

// Whether institutional bank balances should be visible in the admin console
// (per the institution's settings; visible by default).
export async function fetchBalancesVisible() {
  try {
    const settings = await backend.entities.InstitutionSetting.list().then(scoped);
    return settings[0]?.show_bank_balance !== false;
  } catch {
    return true;
  }
}