// Loans can be secured by a member's shares (BOSA) or FOSA savings. The
// collateral stays untouched — the member can borrow up to a multiple of it.
export const LOAN_COLLATERAL_MULTIPLIER = 3;

// Collateral base for a loan source: total share balance or total FOSA savings.
export function collateralBalance(source, { shares = [], accounts = [] } = {}) {
  if (source === "shares") return (shares || []).reduce((s, x) => s + (x.balance || 0), 0);
  if (source === "savings")
    return (accounts || []).filter((a) => a.account_type === "fosa").reduce((s, a) => s + (a.balance || 0), 0);
  return 0;
}

export function maxLoanAmount(source, data) {
  return collateralBalance(source, data) * LOAN_COLLATERAL_MULTIPLIER;
}

export const SOURCE_LABELS = { shares: "Shares (BOSA)", savings: "Savings (FOSA)" };