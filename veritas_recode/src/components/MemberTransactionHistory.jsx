import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import {
  TrendingUp, Banknote, ArrowRightLeft, HandCoins, CreditCard, Receipt,
} from "lucide-react";
import { useMoney } from "@/lib/useMoney";

export default function MemberTransactionHistory({ memberId, memberName }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const { money } = useMoney();

  useEffect(() => {
    const load = async () => {
      try {
        const [loanPayments, memberPayments, shareTxns] = await Promise.all([
          backend.entities.LoanPayment.filter({ member_id: memberId }),
          backend.entities.MemberPayment.filter({ member_id: memberId }),
          backend.entities.ShareTransaction.filter({ from_member_id: memberId }),
        ]);

        const shareTxnsTo = await backend.entities.ShareTransaction.filter({ to_member_id: memberId });
        const allShareTxns = [...shareTxns, ...shareTxnsTo].filter(
          (v, i, a) => a.findIndex((t) => t.id === v.id) === i
        );

        const merged = [
          ...loanPayments.map((p) => ({
            id: p.id,
            date: p.payment_date || "",
            type: "loan_repayment",
            typeLabel: "Loan Repayment",
            description: p.loan_number ? `Loan ${p.loan_number}` : "Loan repayment",
            amount: p.amount || 0,
            reference: p.payment_ref || "",
            status: p.status,
          })),
          ...memberPayments.map((p) => ({
            id: p.id,
            date: p.payment_date || "",
            type: p.payment_type === "shares" ? "share_contribution" : "subscription",
            typeLabel: p.payment_type === "shares" ? "Share Contribution" : "Subscription Fee",
            description: p.payment_type === "shares" ? "Share purchase" : "Membership subscription",
            amount: p.amount || 0,
            reference: p.payment_ref || "",
            status: p.status,
          })),
          ...allShareTxns.map((t) => ({
            id: t.id,
            date: t.date || "",
            type: "share_transaction",
            typeLabel: t.type === "transfer" ? "Share Transfer" : t.type === "contribution" ? "Share Contribution" : "Share Redemption",
            description:
              t.type === "transfer"
                ? t.to_member_id === memberId
                  ? `Received from ${t.from_member_name || "member"}`
                  : `Sent to ${t.to_member_name || "member"}`
                : t.type === "contribution" ? "Automated contribution" : "Redeemed to cash",
            amount: t.amount || 0,
            reference: t.reference || "",
            status: t.status,
          })),
        ];

        merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setTransactions(merged);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId]);

  const filtered = typeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.type === typeFilter);

  const totalIn = transactions
    .filter((t) => t.status === "approved" || t.status === "completed" || t.status === "paid")
    .filter((t) => ["share_contribution", "subscription"].includes(t.type) || (t.type === "share_transaction" && (t.description.startsWith("Received") || t.description === "Automated contribution")))
    .reduce((s, t) => s + (t.amount || 0), 0);
  const totalOut = transactions
    .filter((t) => t.status === "approved" || t.status === "completed" || t.status === "paid")
    .filter((t) => t.type === "loan_repayment" || (t.type === "share_transaction" && !t.description.startsWith("Received")))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const iconMap = {
    loan_repayment: { icon: Banknote, color: "text-amber-500", bg: "bg-amber-950/40" },
    share_contribution: { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-950/40" },
    subscription: { icon: CreditCard, color: "text-purple-500", bg: "bg-purple-950/40" },
    share_transaction: { icon: ArrowRightLeft, color: "text-blue-500", bg: "bg-blue-950/40" },
  };

  const statusStyles = {
    pending: "bg-amber-950/50 text-amber-400 border-amber-800/50",
    approved: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
    completed: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
    paid: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
    rejected: "bg-rose-950/50 text-rose-400 border-rose-800/50",
  };

  return (
    <div className="luxury-card rounded-2xl p-5 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Transaction History</h3>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
        >
          <option value="all">All Transactions</option>
          <option value="loan_repayment">Loan Repayments</option>
          <option value="share_contribution">Share Contributions</option>
          <option value="subscription">Subscriptions</option>
          <option value="share_transaction">Share Transfers/Redemptions</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center">
          <Receipt className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Total Contributions In</p>
              <p className="text-lg font-bold text-emerald-400">{money(totalIn)}</p>
            </div>
            <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Total Repayments Out</p>
              <p className="text-lg font-bold text-amber-400">{money(totalOut)}</p>
            </div>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.map((t) => {
              const cfg = iconMap[t.type] || iconMap.share_transaction;
              const Icon = cfg.icon;
              return (
                <div
                  key={`${t.type}-${t.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{t.typeLabel}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${statusStyles[t.status] || ""}`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.description}
                      {t.reference && <span className="ml-1">· Ref: {t.reference}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {t.date ? new Date(t.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${(t.type === "loan_repayment" || (t.type === "share_transaction" && !t.description.startsWith("Received") && t.description !== "Automated contribution")) ? "text-amber-400" : "text-emerald-400"}`}>
                      {(t.type === "loan_repayment" || (t.type === "share_transaction" && !t.description.startsWith("Received") && t.description !== "Automated contribution")) ? "−" : "+"}{money(t.amount || 0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}