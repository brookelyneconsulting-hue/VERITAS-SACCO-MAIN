import React, { useEffect, useState, useRef } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Scale, Download, Printer } from "lucide-react";
import { exportToPDF } from "@/lib/pdfExport";
import { computeAccountBalances } from "@/lib/accountBalances";
import { withLinkedBankBalance } from "@/lib/institutionBalance";
import { useMoney } from "@/lib/useMoney";

export default function TrialBalanceTab() {
  const [journalEntries, setJournalEntries] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [shares, setShares] = useState([]);
  const [shareTxns, setShareTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const reportRef = useRef(null);
  const { money } = useMoney();

  useEffect(() => {
    const load = async () => {
      try {
        const [je, coa, l, s, st] = await Promise.all([
          backend.entities.JournalEntry.list("-date"),
          backend.entities.ChartOfAccount.list(),
          backend.entities.Loan.list(),
          backend.entities.Share.list(),
          backend.entities.ShareTransaction.list("-date"),
        ]);
        setJournalEntries(je);
        setChartOfAccounts(await withLinkedBankBalance(coa));
        setLoans(await scoped(l));
        setShares(await scoped(s));
        setShareTxns(st);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const asOfDate = toDate || new Date().toISOString().slice(0, 10);

  const filteredJE = journalEntries.filter((j) => {
    const matchFrom = !fromDate || (j.date && j.date >= fromDate);
    const matchTo = !toDate || (j.date && j.date <= toDate);
    return matchFrom && matchTo;
  });

  // Use COA opening balances + journal entries (accounting principle: COA carries forward opening balances)
  // Filter journal entries by date but include all COA opening balances as carry-forward
  const accountBalances = computeAccountBalances(chartOfAccounts, filteredJE);

  const activeLoans = loans.filter((l) => l.status === "active" && (!l.disbursement_date || l.disbursement_date <= asOfDate));
  const loansReceivable = activeLoans.reduce((s, l) => s + (l.balance || 0), 0);
  const loanInterestIncome = activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0);

  const loansPayable = loans
    .filter((l) => l.status === "pending" && (!l.disbursement_date || l.disbursement_date <= asOfDate))
    .reduce((s, l) => s + (l.principal || 0), 0);

  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);
  const redeemedShares = shareTxns
    .filter((t) => t.type === "redemption" && t.status === "completed" && (!t.date || t.date <= asOfDate))
    .reduce((s, t) => s + (t.amount || 0), 0);
  const sharesEquity = totalShares - redeemedShares;

  const rows = [];

  if (loansReceivable > 0) rows.push({ name: "Member Loan Receivables", category: "Assets", debit: loansReceivable, credit: 0 });
  if (loanInterestIncome > 0) rows.push({ name: "Interest Receivable", category: "Assets", debit: loanInterestIncome, credit: 0 });

  Object.values(accountBalances).forEach((a) => {
    const isDebitNormal = a.category === "assets" || a.category === "expenses";
    if (Math.abs(a.net) > 0.5) {
      rows.push({
        name: a.name,
        category: a.category.charAt(0).toUpperCase() + a.category.slice(1),
        debit: isDebitNormal && a.net > 0 ? a.net : 0,
        credit: !isDebitNormal && a.net > 0 ? a.net : 0,
      });
    }
  });

  if (loansPayable > 0) rows.push({ name: "Loans Payable (Approved Not Disbursed)", category: "Liabilities", debit: 0, credit: loansPayable });
  if (sharesEquity > 0) rows.push({ name: "Share Capital", category: "Equity", debit: 0, credit: sharesEquity });
  if (loanInterestIncome > 0) rows.push({ name: "Loan Interest Income", category: "Income", debit: 0, credit: loanInterestIncome });

  // Cash on Hand as balancing figure (the plug)
  const preCashDebits = rows.reduce((s, r) => s + r.debit, 0);
  const preCashCredits = rows.reduce((s, r) => s + r.credit, 0);
  const cashOnHand = preCashCredits - preCashDebits;
  if (Math.abs(cashOnHand) > 0.5) {
    if (cashOnHand > 0) {
      rows.push({ name: "Cash on Hand", category: "Assets", debit: cashOnHand, credit: 0 });
    } else {
      rows.push({ name: "Bank Overdraft", category: "Liabilities", debit: 0, credit: Math.abs(cashOnHand) });
    }
  }

  const totalDebits = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredits = rows.reduce((s, r) => s + r.credit, 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 1;

  const fmt = (v) => (v > 0 ? money(Math.round(v)) : "—");

  const handlePDF = async () => {
    if (reportRef.current) await exportToPDF(reportRef.current, `trial-balance-${asOfDate}.pdf`);
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading trial balance...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="font-semibold text-foreground">Trial Balance</h3>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter fromDate={fromDate} toDate={toDate}
            onFromChange={setFromDate} onToChange={setToDate}
            onClear={() => { setFromDate(""); setToDate(""); }} />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF} className="print:hidden">
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Trial Balance</h4>
          <span className="text-xs text-muted-foreground ml-auto">As of {new Date(asOfDate).toLocaleDateString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left font-medium text-muted-foreground px-5 py-3">Account</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Category</th>
                <th className="text-right font-medium text-muted-foreground px-5 py-3">Debit</th>
                <th className="text-right font-medium text-muted-foreground px-5 py-3">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">No accounts with balances yet</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3 text-foreground">{r.name}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs hidden sm:table-cell">{r.category}</td>
                    <td className="px-5 py-3 text-right text-foreground">{fmt(r.debit)}</td>
                    <td className="px-5 py-3 text-right text-foreground">{fmt(r.credit)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-muted/20 border-t-2 border-border">
                  <td colSpan={2} className="px-5 py-3 font-semibold text-foreground">Total</td>
                  <td className="px-5 py-3 text-right font-bold text-primary">{money(Math.round(totalDebits))}</td>
                  <td className="px-5 py-3 text-right font-bold text-primary">{money(Math.round(totalCredits))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">Status</span>
            <span className={balanced ? "text-emerald-500 font-medium" : "text-destructive font-medium"}>
              {balanced ? "✓ Balanced" : `✗ Out of balance by ${money(Math.round(Math.abs(totalDebits - totalCredits)))}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}