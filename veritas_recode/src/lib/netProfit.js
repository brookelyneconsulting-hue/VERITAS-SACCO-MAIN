import { computeAccountBalances, getNetBalance } from "@/lib/accountBalances";

// Mirrors the Income Statement in the Accounting module (Financial Statements
// tab): income = COA income accounts (net) + loan interest income from active
// loans; expenses = COA expense accounts (net). Net profit = income - expenses,
// with journal entries optionally limited to the selected date range.
export function computeNetProfit({
  loans = [], journalEntries = [], chartOfAccounts = [], fromDate = "", toDate = "",
} = {}) {
  const asOfDate = toDate || new Date().toISOString().slice(0, 10);
  const filteredJE = journalEntries.filter((j) => {
    const matchFrom = !fromDate || (j.date && j.date >= fromDate);
    const matchTo = !toDate || (j.date && j.date <= toDate);
    return matchFrom && matchTo;
  });

  const accountBalances = computeAccountBalances(chartOfAccounts, filteredJE);
  const sumByCategory = (cat) =>
    Object.values(accountBalances)
      .filter((a) => a.category === cat)
      .reduce((s, a) => s + getNetBalance(a), 0);

  const activeLoans = loans.filter(
    (l) => l.status === "active" && (!l.disbursement_date || l.disbursement_date <= asOfDate)
  );
  const loanInterestIncome = activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0);

  const totalIncome = sumByCategory("income") + loanInterestIncome;
  const totalExpenses = sumByCategory("expenses");
  return {
    totalIncome,
    totalExpenses,
    loanInterestIncome,
    netProfit: totalIncome - totalExpenses,
  };
}