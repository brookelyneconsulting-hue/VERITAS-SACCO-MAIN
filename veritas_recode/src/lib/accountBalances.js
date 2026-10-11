/**
 * Computes net balances from Chart of Accounts opening balances + journal entries.
 * Returns an object keyed by `category|name` with { debit, credit, category, name, net }.
 *
 * Accounting principle:
 * - Assets & Expenses are debit-normal: net = (opening_debit - opening_credit) + (journal_debit - journal_credit)
 * - Liabilities, Equity, Income are credit-normal: net = (opening_credit - opening_debit) + (journal_credit - journal_debit)
 */
export function computeAccountBalances(chartOfAccounts, journalEntries) {
  const balances = {};

  // Seed from Chart of Accounts opening balances
  chartOfAccounts.forEach((acc) => {
    if (acc.status === "archived") return;
    const key = `${acc.account_category}|${acc.account_name}`;
    if (!balances[key]) {
      balances[key] = {
        name: acc.account_name,
        category: acc.account_category,
        debit: 0,
        credit: 0,
        subcategory: acc.account_subcategory || "",
        fromCOA: true,
      };
    }
    const ob = acc.opening_balance || 0;
    if (acc.opening_balance_type === "debit") {
      balances[key].debit += ob;
    } else {
      balances[key].credit += ob;
    }
  });

  // Apply journal entries on top
  journalEntries.forEach((j) => {
    const key = `${j.account_category}|${j.account_name}`;
    if (!balances[key]) {
      balances[key] = {
        name: j.account_name,
        category: j.account_category,
        debit: 0,
        credit: 0,
        subcategory: j.account_subcategory || "",
        fromCOA: false,
      };
    }
    balances[key].debit += j.debit || 0;
    balances[key].credit += j.credit || 0;
  });

  // Compute net for each
  Object.values(balances).forEach((a) => {
    const isDebitNormal = a.category === "assets" || a.category === "expenses";
    a.net = isDebitNormal ? a.debit - a.credit : a.credit - a.debit;
  });

  return balances;
}

export function getNetBalance(acc) {
  if (acc.category === "assets" || acc.category === "expenses") return acc.debit - acc.credit;
  return acc.credit - acc.debit;
}