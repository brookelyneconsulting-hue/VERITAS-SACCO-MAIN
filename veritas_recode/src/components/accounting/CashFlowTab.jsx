import React, { useEffect, useState, useRef } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Waves, Download, Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { exportToPDF } from "@/lib/pdfExport";
import { computeAccountBalances } from "@/lib/accountBalances";
import { computeInstitutionBankBalance, withLinkedBankBalance } from "@/lib/institutionBalance";
import { useMoney } from "@/lib/useMoney";

export default function CashFlowTab() {
  const reportRef = useRef(null);
  const { money } = useMoney();
  const [loans, setLoans] = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [shareTxns, setShareTxns] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [l, lp, mp, st, je, coa] = await Promise.all([
          backend.entities.Loan.list().then(scoped),
          backend.entities.LoanPayment.list("-payment_date").then(scoped),
          backend.entities.MemberPayment.list("-payment_date").then(scoped),
          backend.entities.ShareTransaction.list("-date"),
          backend.entities.JournalEntry.list("-date"),
          backend.entities.ChartOfAccount.list(),
        ]);
        setLoans(l);
        setLoanPayments(lp);
        setMemberPayments(mp);
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

  const inRange = (date) => {
    if (!date) return false;
    const matchFrom = !fromDate || date >= fromDate;
    const matchTo = !toDate || date <= toDate;
    return matchFrom && matchTo;
  };

  // Operating Activities — subscription fees received + manual income - expenses paid
  const subscriptionFees = memberPayments
    .filter((p) => p.status === "approved" && p.payment_type === "subscription" && inRange(p.payment_date))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const filteredJE = journalEntries.filter((j) => inRange(j.date));
  const accountBalances = computeAccountBalances(chartOfAccounts, filteredJE);
  const expenseAccounts = {};
  const incomeAccounts = {};
  Object.values(accountBalances).forEach((a) => {
    if (a.category === "expenses" && a.net > 0) expenseAccounts[a.name] = a.net;
    if (a.category === "income" && a.net > 0) incomeAccounts[a.name] = a.net;
  });
  const totalExpenses = Object.values(expenseAccounts).reduce((s, v) => s + Math.max(0, v), 0);
  const manualIncome = Object.values(incomeAccounts).reduce((s, v) => s + Math.max(0, v), 0);
  const netOperatingCash = subscriptionFees + manualIncome - totalExpenses;

  // Investing Activities
  const loanDisbursements = loans
    .filter((l) => inRange(l.disbursement_date))
    .reduce((s, l) => s + (l.principal || 0), 0);
  const loanRepayments = loanPayments
    .filter((p) => p.status === "approved" && inRange(p.payment_date))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const netInvestingCash = loanRepayments - loanDisbursements;

  // Financing Activities — cash share contributions received (approved payments)
  const shareContributions = memberPayments
    .filter((p) => p.status === "approved" && p.payment_type === "shares" && inRange(p.payment_date))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const shareRedemptions = shareTxns
    .filter((t) => t.type === "redemption" && (t.status === "completed" || t.status === "approved") && inRange(t.date))
    .reduce((s, t) => s + (t.amount || 0), 0);
  const netFinancingCash = shareContributions - shareRedemptions;

  const netChangeInCash = netOperatingCash + netInvestingCash + netFinancingCash;

  // Tie the statement to the institution's live bank balance (same source as
  // the Dashboard banner and the linked Chart of Accounts bank account).
  const beginAsOf = fromDate
    ? new Date(new Date(fromDate).getTime() - 86400000).toISOString().slice(0, 10)
    : null;
  const beginningCash = beginAsOf
    ? computeInstitutionBankBalance({ loans, loanPayments, memberPayments, journalEntries, shareTxns, asOf: beginAsOf }).bankBalance
    : 0;
  const endingCash = computeInstitutionBankBalance({ loans, loanPayments, memberPayments, journalEntries, shareTxns, asOf: asOfDate }).bankBalance;
  const unreconciled = endingCash - (beginningCash + netChangeInCash);
  const isBalanced = Math.abs(unreconciled) < 1;

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading cash flow data...</div>;

  const fmt = (v) => money(Math.round(v));
  const Row = ({ label, value, isTotal, indent }) => (
    <div className={`flex justify-between text-sm py-1.5 ${isTotal ? "font-bold border-t border-border pt-2" : ""} ${indent ? "pl-4" : ""}`}>
      <span className={isTotal ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={isTotal ? "text-foreground" : value >= 0 ? "text-foreground" : "text-rose-500"}>{fmt(value)}</span>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="font-semibold text-foreground">Cash Flow Statement</h3>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onClear={() => { setFromDate(""); setToDate(""); }}
          />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToPDF(reportRef.current, "cash-flow-statement.pdf")} className="print:hidden">
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
          <Waves className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Cash Flow Statement</h4>
          <span className="text-xs text-muted-foreground ml-auto">
            {fromDate ? new Date(fromDate).toLocaleDateString() : "All time"} — {new Date(asOfDate).toLocaleDateString()}
          </span>
        </div>
        <div className="p-5 space-y-6">
          {/* Operating Activities */}
          <div>
            <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Cash from Operating Activities
            </h5>
            <Row label="Subscription Fees Received" value={subscriptionFees} indent />
            {Object.entries(incomeAccounts).map(([name, val]) => val > 0 && (
              <Row key={name} label={name} value={val} indent />
            ))}
            {Object.entries(expenseAccounts).map(([name, val]) => val > 0 && (
              <Row key={name} label={name} value={-val} indent />
            ))}
            <Row label="Net Cash from Operations" value={netOperatingCash} isTotal />
          </div>

          {/* Investing Activities */}
          <div>
            <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Minus className="w-4 h-4 text-amber-500" />
              Cash from Investing Activities
            </h5>
            <Row label="Loan Disbursements" value={-loanDisbursements} indent />
            <Row label="Loan Repayments Received" value={loanRepayments} indent />
            <Row label="Net Cash from Investing" value={netInvestingCash} isTotal />
          </div>

          {/* Financing Activities */}
          <div>
            <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-blue-500" />
              Cash from Financing Activities
            </h5>
            <Row label="Share Contributions Received" value={shareContributions} indent />
            <Row label="Share Redemptions" value={-shareRedemptions} indent />
            <Row label="Net Cash from Financing" value={netFinancingCash} isTotal />
          </div>

          {/* Net Change & reconciliation to the live bank balance */}
          <div className="bg-muted/30 rounded-xl p-4">
            <Row label="Cash at Beginning of Period (per Bank)" value={beginningCash} />
            <Row label="Net Change in Cash" value={netChangeInCash} />
            <Row label="Expected Cash at End of Period" value={beginningCash + netChangeInCash} isTotal />
            {!isBalanced && (
              <Row label="Unreconciled Difference (non-cash / manual adjustments)" value={unreconciled} />
            )}
            <Row label="Cash at End of Period (per Bank — linked to Chart of Accounts)" value={endingCash} isTotal />
            <div className={`mt-2 flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium ${isBalanced ? "text-emerald-500" : "text-amber-500"}`}>
              {isBalanced
                ? "✓ Balanced — ties to the institution's live bank balance."
                : "⚠ Expected cash does not fully tie to the bank balance — the difference is shown above."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}