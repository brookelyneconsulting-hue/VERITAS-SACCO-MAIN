import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";

// Single source of truth for the institution's live bank balance.
// Bank balance: cash in (approved member payments + approved loan repayments
// incl. interest) minus cash out (disbursed loans + paid expenses + share
// redemptions + dividend payouts). Used by the admin Dashboard banner and to
// keep the linked
// "Bank Accounts" row in the Chart of Accounts in sync.

// Optional `asOf` (YYYY-MM-DD): balance as of that date (inclusive) — used by
// the Cash Flow statement for opening/closing bank balances.
export function computeInstitutionBankBalance({
  loans = [], loanPayments = [], memberPayments = [], journal = [], shareTx = [], dividends = [], deposits = [], withdrawals = [], asOf,
} = {}) {
  const onOrBefore = (d) => !asOf || !d || d <= asOf;
  // Standalone cash receipts (bank deposits not linked to a member/loan
  // payment — e.g. Banking tab "Others" receipts) count as cash in.
  const directReceipts = deposits
    .filter((d) => !d.payment_id && onOrBefore(d.deposit_date))
    .reduce((s, d) => s + (d.amount || 0), 0);
  const cashInflows =
    memberPayments.filter((p) => p.status === "approved" && onOrBefore(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0) +
    loanPayments.filter((p) => p.status === "approved" && onOrBefore(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0) +
    directReceipts;

  const disbursedLoans = loans
    .filter((l) => (l.disbursement_date || l.status !== "pending") && onOrBefore(l.disbursement_date))
    .reduce((s, l) => s + (l.principal || 0), 0);
  const expensesPaid = journal
    .filter((j) => j.account_category === "expenses" && onOrBefore(j.date))
    .reduce((s, j) => s + Math.max(0, (j.debit || 0) - (j.credit || 0)), 0);
  const redemptions = shareTx
    .filter((t) => t.type === "redemption" && (t.status === "completed" || t.status === "approved") && onOrBefore(t.date))
    .reduce((s, t) => s + (t.amount || 0), 0);
  const dividendPayouts = dividends
    .filter((d) => onOrBefore(d.payment_date))
    .reduce((s, d) => s + (d.dividend_amount || 0), 0);
  // Counter withdrawals (Banking tab cash payouts) count as cash out.
  const counterWithdrawals = withdrawals
    .filter((w) => onOrBefore(w.withdrawal_date))
    .reduce((s, w) => s + (w.amount || 0), 0);
  const cashOutflows = disbursedLoans + expensesPaid + redemptions + dividendPayouts + counterWithdrawals;

  return { bankBalance: cashInflows - cashOutflows, cashInflows, cashOutflows };
}

// The asset account in the chart of accounts that represents the
// institution's bank account (e.g. "Bank Accounts").
export function isBankAssetAccount(a) {
  return a?.account_category === "assets" && /bank/i.test(a.account_name || "");
}

// Fetches the raw data and computes the live institution bank balance.
export async function fetchInstitutionBankBalance() {
  const [loans, loanPayments, memberPayments, journal, shareTx, dividends, deposits, withdrawals] = await Promise.all([
    backend.entities.Loan.list().then(scoped).catch(() => []),
    backend.entities.LoanPayment.list("-payment_date").then(scoped).catch(() => []),
    backend.entities.MemberPayment.list("-payment_date").then(scoped).catch(() => []),
    backend.entities.JournalEntry.list().catch(() => []),
    backend.entities.ShareTransaction.list().catch(() => []),
    backend.entities.DividendPayment.list().then(scoped).catch(() => []),
    backend.entities.BankDeposit.list().then(scoped).catch(() => []),
    backend.entities.BankWithdrawal.list("-withdrawal_date").then(scoped).catch(() => []),
  ]);
  return computeInstitutionBankBalance({ loans, loanPayments, memberPayments, journal, shareTx, dividends, deposits, withdrawals });
}

// Replaces the linked bank asset account's opening_balance with the live
// institution bank balance so financial statements reflect it automatically.
export function linkBankAccountBalance(chartOfAccounts, bankBalance) {
  const idx = chartOfAccounts.findIndex(isBankAssetAccount);
  if (idx === -1) return chartOfAccounts;
  const copy = [...chartOfAccounts];
  copy[idx] = { ...copy[idx], opening_balance: bankBalance, opening_balance_type: "debit" };
  return copy;
}

// Fetches the live balance and returns a COA array with the bank row linked.
export async function withLinkedBankBalance(chartOfAccounts) {
  const { bankBalance } = await fetchInstitutionBankBalance();
  return linkBankAccountBalance(chartOfAccounts, bankBalance);
}