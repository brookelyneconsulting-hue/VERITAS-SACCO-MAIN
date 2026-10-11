import React, { useEffect, useState, useCallback } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Banknote, CheckCircle2, Loader2, Landmark } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useMoney } from "@/lib/useMoney";

// Builds a unified "un-deposited receipt" row from an approved payment.
const toRow = (p, kind) => {
  if (kind === "loan_payment") {
    return {
      id: p.id,
      type: "loan_payment",
      label: "Loan Repayment",
      source_type: "loan_repayment",
      member_name: p.member_name,
      amount: p.amount,
      date: p.payment_date,
      ref: p.payment_ref,
    };
  }
  const isShares = p.payment_type === "shares";
  const isSub = p.payment_type === "subscription";
  return {
    id: p.id,
    type: "member_payment",
    label: isShares ? "Shares" : isSub ? "Subscription" : "Income",
    source_type: isShares ? "shares" : isSub ? "subscription" : "other",
    member_name: p.member_name,
    amount: p.amount,
    date: p.payment_date,
    ref: p.payment_ref,
  };
};

export default function PhysicalDepositPanel({ mode }) {
  const { money } = useMoney();
  const [loanPayments, setLoanPayments] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    try {
      const [lp, mp, bd] = await Promise.all([
        backend.entities.LoanPayment.list("-payment_date").then(scoped),
        backend.entities.MemberPayment.list("-payment_date").then(scoped),
        backend.entities.BankDeposit.list("-deposit_date"),
      ]);
      setLoanPayments(lp);
      setMemberPayments(mp);
      setDeposits(bd);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "manual") return;
    load();
    let unsub;
    try { unsub = backend.entities.BankDeposit.subscribe(() => load()); } catch {}
    return () => unsub && unsub();
  }, [mode, load]);

  if (mode !== "manual") return null;

  const depositedIds = new Set(deposits.map((d) => d.payment_id).filter(Boolean));

  const rows = [
    ...loanPayments.filter((p) => p.status === "approved" && !depositedIds.has(p.id)).map((p) => toRow(p, "loan_payment")),
    ...memberPayments.filter((p) => p.status === "approved" && !depositedIds.has(p.id)).map((p) => toRow(p, "member_payment")),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totalUndeposited = rows.reduce((s, r) => s + (r.amount || 0), 0);

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

  const depositAll = async () => {
    let ok = 0;
    for (const row of rows) {
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
        ok++;
      } catch {}
    }
    toast({ title: `${ok} deposit(s) recorded`, description: `${money(rows.reduce((s, r) => s + (r.amount || 0), 0))} banked.` });
    load();
  };

  return (
    <div className="mb-6 luxury-card rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Physical Deposit to Bank</h3>
            <p className="text-xs text-muted-foreground">
              Received repayments &amp; incomes not yet banked — press Deposit to record a physical bank deposit.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cash in Till</p>
            <p className="text-lg font-bold text-amber-500">{money(totalUndeposited)}</p>
          </div>
          {rows.length > 0 && (
            <Button onClick={depositAll} className="bg-emerald-600 hover:bg-emerald-700">
              <Banknote className="w-4 h-4 mr-2" /> Deposit All
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-muted-foreground text-sm">Loading receipts...</div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 justify-center p-6 text-emerald-500 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5" /> All received funds have been banked.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Date</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Member</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Type</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Reference</th>
                <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-b border-border/30 hover:bg-muted/10">
                  <td className="px-3 py-2 text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-foreground font-medium">{r.member_name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{r.ref || "—"}</td>
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
  );
}