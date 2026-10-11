import React from "react";
import { useMoney } from "@/lib/useMoney";
import { Receipt } from "lucide-react";

// Latest cash receipts (loan repayments + member payments).
export default function RecentReceiptsTable({ loanPayments, memberPayments, otherReceipts = [], withdrawals = [] }) {
  const { money } = useMoney();

  const rows = [
    ...withdrawals.map((w) => ({
      key: `W-${w.id}`,
      date: w.withdrawal_date,
      member: w.member_name || "",
      label: `Counter Withdrawal — ${w.account_type === "bosa" ? "BOSA" : "FOSA"}`,
      ref: w.reference,
      amount: -(w.amount || 0),
    })),
    ...otherReceipts.map((d) => ({
      key: `D-${d.id}`,
      date: d.deposit_date,
      member: d.member_name || "",
      label: d.description || "Other Receipt",
      ref: d.reference,
      amount: d.amount,
    })),
    ...loanPayments.map((p) => ({
      key: `L-${p.id}`,
      date: p.payment_date,
      member: p.member_name,
      label: "Loan Repayment",
      ref: p.payment_ref,
      amount: p.amount,
    })),
    ...memberPayments.map((p) => ({
      key: `M-${p.id}`,
      date: p.payment_date,
      member: p.member_name,
      label: p.payment_type === "shares" ? "Share Contribution" : p.payment_type === "subscription" ? "Subscription" : "Income",
      ref: p.payment_ref,
      amount: p.amount,
    })),
  ]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 10);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Recent Receipts</h4>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">
          No cash receipts recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Member</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden sm:table-cell">Reference</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="px-5 py-3 text-muted-foreground">
                    {r.date ? new Date(r.date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{r.member || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.label}</td>
                  <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{r.ref || "—"}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${r.amount < 0 ? "text-red-400" : "text-emerald-500"}`}>{money(r.amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}