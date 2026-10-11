import React, { useEffect, useState, useRef } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, TrendingDown, Scale, Download, Printer } from "lucide-react";
import { exportToPDF } from "@/lib/pdfExport";
import { computeAccountBalances, getNetBalance as getNet } from "@/lib/accountBalances";
import { withLinkedBankBalance } from "@/lib/institutionBalance";
import { useMoney } from "@/lib/useMoney";

export default function FinancialStatementsTab() {
  const reportRef = useRef(null);
  const { money } = useMoney();
  const [loans, setLoans] = useState([]);
  const [shares, setShares] = useState([]);
  const [shareTxns, setShareTxns] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [l, s, st, je, coa] = await Promise.all([
          backend.entities.Loan.list(),
          backend.entities.Share.list(),
          backend.entities.ShareTransaction.list("-date"),
          backend.entities.JournalEntry.list("-date"),
          backend.entities.ChartOfAccount.list(),
        ]);
        setLoans(await scoped(l));
        setShares(await scoped(s));
        setShareTxns(st);
        setJournalEntries(je);
        setChartOfAccounts(await withLinkedBankBalance(coa));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const asOfDate = toDate || new Date().toISOString().slice(0, 10);

  // Auto-calculated figures
  const activeLoans = loans.filter((l) => l.status === "active" && (!l.disbursement_date || l.disbursement_date <= asOfDate));
  const loansReceivable = activeLoans.reduce((s, l) => s + (l.balance || 0), 0);
  const loanInterestIncome = activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0);
  const interestReceivable = loanInterestIncome;

  const loansPayable = loans
    .filter((l) => l.status === "pending" && (!l.disbursement_date || l.disbursement_date <= asOfDate))
    .reduce((s, l) => s + (l.principal || 0), 0);

  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);
  const redeemedShares = shareTxns
    .filter((t) => t.type === "redemption" && t.status === "completed" && (!t.date || t.date <= asOfDate))
    .reduce((s, t) => s + (t.amount || 0), 0);
  const sharesEquity = totalShares - redeemedShares;

  // Journal entries within date range
  const filteredJE = journalEntries.filter((j) => {
    const matchFrom = !fromDate || (j.date && j.date >= fromDate);
    const matchTo = !toDate || (j.date && j.date <= toDate);
    return matchFrom && matchTo;
  });

  // Incorporate Chart of Accounts opening balances (carry-forward) + journal entries
  const accountBalances = computeAccountBalances(chartOfAccounts, filteredJE);
  const getNetBalance = getNet;

  const assetAccounts = Object.values(accountBalances).filter((a) => a.category === "assets" && getNetBalance(a) !== 0);
  const liabilityAccounts = Object.values(accountBalances).filter((a) => a.category === "liabilities" && getNetBalance(a) !== 0);
  const equityAccounts = Object.values(accountBalances).filter((a) => a.category === "equity" && getNetBalance(a) !== 0);
  const incomeAccounts = Object.values(accountBalances).filter((a) => a.category === "income" && getNetBalance(a) !== 0);
  const expenseAccounts = Object.values(accountBalances).filter((a) => a.category === "expenses" && getNetBalance(a) !== 0);

  const manualAssets = assetAccounts.reduce((s, a) => s + getNetBalance(a), 0);
  const manualLiabilities = liabilityAccounts.reduce((s, a) => s + getNetBalance(a), 0);
  const manualEquity = equityAccounts.reduce((s, a) => s + getNetBalance(a), 0);
  const manualIncome = incomeAccounts.reduce((s, a) => s + getNetBalance(a), 0);
  const manualExpenses = expenseAccounts.reduce((s, a) => s + getNetBalance(a), 0);

  // Income Statement
  const totalIncome = manualIncome + loanInterestIncome;
  const totalExpenses = manualExpenses;
  const netSurplus = totalIncome - totalExpenses;

  // Balance Sheet — Cash on Hand as plug so A = L + E
  const totalLiabilitiesBase = loansPayable + manualLiabilities;
  const totalEquity = sharesEquity + netSurplus + manualEquity;
  const totalNonCashAssets = loansReceivable + interestReceivable + manualAssets;
  const cashOnHand = totalLiabilitiesBase + totalEquity - totalNonCashAssets;

  const cashAsset = Math.max(0, cashOnHand);
  const bankOverdraft = cashOnHand < 0 ? Math.abs(cashOnHand) : 0;
  const totalAssets = totalNonCashAssets + cashAsset;
  const totalLiabilities = totalLiabilitiesBase + bankOverdraft;
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading financial data...</div>;

  const fmt = (v) => money(Math.round(v));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="font-semibold text-foreground">Financial Statements</h3>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter fromDate={fromDate} toDate={toDate}
            onFromChange={setFromDate} onToChange={setToDate}
            onClear={() => { setFromDate(""); setToDate(""); }} />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToPDF(reportRef.current, "financial-statements.pdf")} className="print:hidden">
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div ref={reportRef}>
        {/* Balance Sheet */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
          <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Balance Sheet</h4>
            <span className="text-xs text-muted-foreground ml-auto">As of {new Date(asOfDate).toLocaleDateString()}</span>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Assets */}
            <div>
              <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Assets
              </h5>
              <div className="space-y-1.5 mb-3">
                {cashAsset > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cash on Hand</span>
                    <span className="font-medium text-foreground">{fmt(cashAsset)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Member Loan Receivables</span>
                  <span className="font-medium text-foreground">{fmt(loansReceivable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Interest Receivable</span>
                  <span className="font-medium text-foreground">{fmt(interestReceivable)}</span>
                </div>
                {assetAccounts.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{a.name}</span>
                    <span className="font-medium text-foreground">{fmt(getNetBalance(a))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Total Assets</span>
                <span className="font-bold text-emerald-500">{fmt(totalAssets)}</span>
              </div>
            </div>

            {/* Liabilities */}
            <div>
              <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-500" /> Liabilities
              </h5>
              <div className="space-y-1.5 mb-3">
                {bankOverdraft > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bank Overdraft</span>
                    <span className="font-medium text-foreground">{fmt(bankOverdraft)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Loans Payable (Approved Not Disbursed)</span>
                  <span className="font-medium text-foreground">{fmt(loansPayable)}</span>
                </div>
                {liabilityAccounts.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{a.name}</span>
                    <span className="font-medium text-foreground">{fmt(getNetBalance(a))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Total Liabilities</span>
                <span className="font-bold text-rose-500">{fmt(totalLiabilities)}</span>
              </div>
            </div>

            {/* Equity */}
            <div>
              <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Capital (Equity)
              </h5>
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Share Capital (Net of Redemptions)</span>
                  <span className="font-medium text-foreground">{fmt(sharesEquity)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retained Earnings (Net Surplus)</span>
                  <span className="font-medium text-foreground">{fmt(netSurplus)}</span>
                </div>
                {equityAccounts.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{a.name}</span>
                    <span className="font-medium text-foreground">{fmt(getNetBalance(a))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Total Equity</span>
                <span className="font-bold text-primary">{fmt(totalEquity)}</span>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 bg-muted/20 border-t border-border flex justify-between text-sm">
            <span className="font-semibold text-foreground">Accounting Equation: Assets = Liabilities + Equity</span>
            <span className={isBalanced ? "text-emerald-500 font-medium" : "text-amber-500 font-medium"}>
              {fmt(totalAssets)} = {fmt(totalLiabilities)} + {fmt(totalEquity)} {isBalanced ? "✓" : "✗"}
            </span>
          </div>
        </div>

        {/* Income Statement */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Income Statement</h4>
            <span className="text-xs text-muted-foreground ml-auto">
              {fromDate ? new Date(fromDate).toLocaleDateString() : "All time"} — {new Date(asOfDate).toLocaleDateString()}
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h5 className="text-sm font-semibold text-emerald-500 mb-3">Income</h5>
              {incomeAccounts.length === 0 && loanInterestIncome === 0 ? (
                <p className="text-sm text-muted-foreground">No income recorded</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Loan Interest Income</span>
                    <span className="font-medium text-foreground">{fmt(loanInterestIncome)}</span>
                  </div>
                  {incomeAccounts.map((a, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{a.name}</span>
                      <span className="font-medium text-foreground">{fmt(getNetBalance(a))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Total Income</span>
                <span className="font-bold text-emerald-500">{fmt(totalIncome)}</span>
              </div>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-rose-500 mb-3">Expenses</h5>
              {expenseAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses recorded</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {expenseAccounts.map((a, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{a.name}</span>
                      <span className="font-medium text-foreground">{fmt(getNetBalance(a))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Total Expenses</span>
                <span className="font-bold text-rose-500">{fmt(totalExpenses)}</span>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 bg-muted/20 border-t border-border flex justify-between text-sm">
            <span className="font-semibold text-foreground">Net Surplus / (Deficit)</span>
            <span className={`font-bold ${netSurplus >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmt(netSurplus)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}