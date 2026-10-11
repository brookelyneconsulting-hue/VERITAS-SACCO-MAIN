import React, { useEffect, useState, useCallback } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import {
  Landmark, CheckCircle2, AlertCircle, Banknote, Wallet,
  Coins, Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useMoney } from "@/lib/useMoney";
import { computeInstitutionBankBalance } from "@/lib/institutionBalance";
import { MASKED_BALANCE } from "@/lib/bankBalanceVisibility";

const toRow = (p, kind) => {
  if (kind === "loan_payment") {
    return {
      id: p.id, type: "loan_payment", label: "Loan Repayment", source_type: "loan_repayment",
      member_name: p.member_name, amount: p.amount, date: p.payment_date, ref: p.payment_ref,
    };
  }
  const isShares = p.payment_type === "shares";
  const isSub = p.payment_type === "subscription";
  return {
    id: p.id, type: "member_payment",
    label: isShares ? "Shares" : isSub ? "Subscription" : "Income",
    source_type: isShares ? "shares" : isSub ? "subscription" : "other",
    member_name: p.member_name, amount: p.amount, date: p.payment_date, ref: p.payment_ref,
  };
};

export default function BankReconciliationTab() {
  const { money } = useMoney();
  const [loans, setLoans] = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [journal, setJournal] = useState([]);
  const [shareTx, setShareTx] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    try {
      const [l, lp, mp, j, st, bd, s] = await Promise.all([
        backend.entities.Loan.list().then(scoped),
        backend.entities.LoanPayment.list("-payment_date").then(scoped),
        backend.entities.MemberPayment.list("-payment_date").then(scoped),
        backend.entities.JournalEntry.list().catch(() => []),
        backend.entities.ShareTransaction.list().catch(() => []),
        backend.entities.BankDeposit.list("-deposit_date"),
        backend.entities.InstitutionSetting.list().catch(() => []),
      ]);
      setLoans(l); setLoanPayments(lp); setMemberPayments(mp); setJournal(j);
      setShareTx(st); setDeposits(bd); setSettings(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let unsub;
    try { unsub = backend.entities.BankDeposit.subscribe(() => load()); } catch {}
    return () => unsub && unsub();
  }, [load]);

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading bank reconciliation...</div>;
  }

  const mode = settings[0]?.deposit_mode === "manual" ? "manual" : "auto";
  const balancesVisible = settings[0]?.show_bank_balance !== false;

  const approvedLoan = loanPayments.filter((p) => p.status === "approved");
  const approvedMember = memberPayments.filter((p) => p.status === "approved");
  // Single source of truth — same bank balance as the Dashboard banner and the
  // linked "Bank Accounts" row in the Chart of Accounts.
  const { bankBalance: bookBalance, cashInflows: totalReceipts, cashOutflows: totalOutflows } =
    computeInstitutionBankBalance({ loans, loanPayments, memberPayments, journal, shareTx });
  const totalDeposits = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const depositedAmount = mode === "auto" ? totalReceipts : totalDeposits;
  const undeposited = Math.max(0, totalReceipts - depositedAmount);
  const reconciledBank = depositedAmount - totalOutflows;
  const balanced = Math.round(undeposited) === 0;

  // Un-deposited receipts (manual mode only)
  const depositedIds = new Set(deposits.map((d) => d.payment_id).filter(Boolean));
  const undepositedRows = [];
  if (mode === "manual") {
    approvedLoan.forEach((p) => {
      if (!depositedIds.has(p.id)) undepositedRows.push(toRow(p, "loan_payment"));
    });
    approvedMember.forEach((p) => {
      if (!depositedIds.has(p.id)) undepositedRows.push(toRow(p, "member_payment"));
    });
    undepositedRows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  const deposit = async (row) => {
    setBusy((s) => ({ ...s, [row.id]: true }));
    try {
      await backend.entities.BankDeposit.create({
        institution_id: await institutionIdForCreate(),
        deposit_date: new Date().toISOString().slice(0, 10),
        amount: row.amount,
        source_type: row.source_type,
        reference: row.ref || "",
        description: `${row.label} — ${row.member_name || ""}`.trim(),
        payment_id: row.id,
        payment_type: row.type,
        member_name: row.member_name || "",
      });
      toast({ title: "Deposited to bank", description: `${money(row.amount || 0)} banked successfully.` });
      load();
    } catch {
      toast({ title: "Could not record deposit", variant: "destructive" });
    }
    setBusy((s) => ({ ...s, [row.id]: false }));
  };

  const summaryCards = [
    { label: "Book Bank Balance", value: balancesVisible ? money(bookBalance) : MASKED_BALANCE, icon: Wallet, tone: "text-foreground" },
    { label: "Physical Deposits to Bank", value: money(totalDeposits), icon: Banknote, tone: "text-primary" },
    { label: "Cash in Till (Un-deposited)", value: money(undeposited), icon: Coins, tone: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Reconciliation statement */}
      <div className="luxury-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Bank Reconciliation Statement</h3>
          <span className="ml-auto text-xs text-muted-foreground uppercase tracking-wide">
            {mode === "auto" ? "Auto-deposit mode" : "Manual deposit mode"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-1 text-sm">
          <div className="flex justify-between border-b border-border/50 py-2">
            <span className="text-muted-foreground">Total Receipts (approved)</span>
            <span className="font-medium text-foreground">{money(totalReceipts)}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 py-2">
            <span className="text-muted-foreground">Total Outflows (loans / expenses / redemptions)</span>
            <span className="font-medium text-foreground">-{money(totalOutflows)}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 py-2">
            <span className="text-muted-foreground">Book Bank Balance (per system)</span>
            <span className="font-semibold text-foreground">{balancesVisible ? money(bookBalance) : MASKED_BALANCE}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 py-2">
            <span className="text-muted-foreground">Total Physical Deposits to Bank</span>
            <span className="font-semibold text-primary">{money(totalDeposits)}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 py-2">
            <span className="text-muted-foreground">Less: Un-deposited Receipts (cash in till)</span>
            <span className="font-medium text-amber-500">-{money(undeposited)}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 py-2">
            <span className="text-muted-foreground">Reconciled Bank Balance (per deposits)</span>
            <span className="font-semibold text-emerald-500">{balancesVisible ? money(reconciledBank) : MASKED_BALANCE}</span>
          </div>
        </div>
        <div className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${
          balanced
            ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
            : "bg-amber-950/40 text-amber-400 border border-amber-800/40"
        }`}>
          {balanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {balanced
            ? (mode === "auto"
                ? "Balanced — auto-deposit mode. All receipts are banked automatically."
                : "Balanced — all received funds have been banked.")
            : `${money(undeposited)} received but not yet banked. Deposit it to reconcile the bank balance.`}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="luxury-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
              <p className={`text-xl font-bold ${c.tone}`}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Deposits + un-deposited */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Physical deposits */}
        <div className="luxury-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground">Physical Deposits to Bank</h4>
          </div>
          {deposits.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {mode === "auto"
                ? "Auto-deposit mode — receipts are banked automatically; no manual deposits recorded."
                : "No deposits recorded yet. Deposit received funds from the panel on the left."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Date</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Source</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Member</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.slice(0, 12).map((d) => (
                    <tr key={d.id} className="border-b border-border/30">
                      <td className="px-3 py-2 text-muted-foreground">{d.deposit_date ? new Date(d.deposit_date).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2 text-foreground capitalize">{(d.source_type || "").replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{d.member_name || "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">{money(d.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 border-t-2 border-border">
                    <td colSpan={3} className="px-3 py-2 font-semibold text-foreground">Total Deposits</td>
                    <td className="px-3 py-2 text-right font-bold text-primary">{money(totalDeposits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Un-deposited receipts */}
        {mode === "manual" && (
          <div className="luxury-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-4 h-4 text-amber-500" />
              <h4 className="font-semibold text-foreground">Un-deposited Receipts (Cash in Till)</h4>
            </div>
            {undepositedRows.length === 0 ? (
              <div className="flex items-center gap-2 justify-center p-4 text-emerald-500 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> All received funds have been banked.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Member</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Type</th>
                      <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {undepositedRows.slice(0, 12).map((r) => (
                      <tr key={`${r.type}-${r.id}`} className="border-b border-border/30">
                        <td className="px-3 py-2 text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-2 text-foreground font-medium">{r.member_name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{money(r.amount || 0)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" onClick={() => deposit(r)} disabled={busy[r.id]} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                            {busy[r.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Banknote className="w-3.5 h-3.5 mr-1" />Deposit</>}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}