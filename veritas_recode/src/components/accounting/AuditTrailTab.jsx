import React, { useEffect, useState, useCallback } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import { useMoney } from "@/lib/useMoney";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ArrowDownCircle, ArrowUpCircle, Lock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EVENT_TYPES = ["all", "cash_in", "cash_out", "loan_issued", "shares", "dividend"];

const eventLabel = (type) =>
  ({
    cash_in: "Cash In (Receipt)",
    cash_out: "Cash Out (Withdrawal)",
    loan_issued: "Loan Issued",
    shares: "Share Transaction",
    dividend: "Dividend Payout",
  })[type] || type;

export default function AuditTrailTab() {
  const { money } = useMoney();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [dep, wd, loans, lp, mp, stx, div] = await Promise.all([
        backend.entities.BankDeposit.list("-deposit_date", 200).then(scoped).catch(() => []),
        backend.entities.BankWithdrawal.list("-withdrawal_date", 200).then(scoped).catch(() => []),
        backend.entities.Loan.list("-created_date", 200).then(scoped).catch(() => []),
        backend.entities.LoanPayment.list("-payment_date", 200).then(scoped).catch(() => []),
        backend.entities.MemberPayment.list("-payment_date", 200).then(scoped).catch(() => []),
        backend.entities.ShareTransaction.list("-date", 200).then(scoped).catch(() => []),
        backend.entities.DividendPayment.list("-payment_date", 200).then(scoped).catch(() => []),
      ]);

      const rows = [
        ...dep.map((d) => ({
          date: d.deposit_date,
          type: "cash_in",
          description: d.description || `Bank deposit (${d.source_type || "other"})`,
          party: d.member_name || "—",
          reference: d.reference || d.id?.slice(0, 8) || "—",
          amount: d.amount,
        })),
        ...wd.map((w) => ({
          date: w.withdrawal_date,
          type: "cash_out",
          description: w.description || `Counter withdrawal${w.fee ? ` (fee ${money(w.fee)})` : ""}`,
          party: w.member_name || "—",
          reference: w.reference || w.id?.slice(0, 8) || "—",
          amount: -w.amount,
        })),
        ...loans.map((l) => ({
          date: l.disbursement_date || l.created_date?.slice(0, 10) || "",
          type: "loan_issued",
          description: `Loan issued — ${l.loan_number || "unnumbered"} @ ${l.interest_rate ?? 0}%`,
          party: l.member_name || "—",
          reference: l.loan_number || l.id?.slice(0, 8) || "—",
          amount: -l.principal,
        })),
        ...lp.map((p) => ({
          date: p.payment_date,
          type: "cash_in",
          description: `Loan repayment — ${p.loan_number || "loan"}`,
          party: p.member_name || "—",
          reference: p.payment_ref || "—",
          amount: p.amount,
        })),
        ...mp.map((p) => ({
          date: p.payment_date,
          type: "cash_in",
          description: `Member payment (${p.payment_type || "subscription"})`,
          party: p.member_name || "—",
          reference: p.payment_ref || "—",
          amount: p.amount,
        })),
        ...stx
          .filter((t) => t.type === "contribution")
          .map((t) => ({
            date: t.date,
            type: "shares",
            description: "Share contribution",
            party: t.to_member_name || t.from_member_name || "—",
            reference: t.reference || t.id?.slice(0, 8) || "—",
            amount: t.amount,
          })),
        ...div.map((d) => ({
          date: d.payment_date,
          type: "dividend",
          description: `Dividend payout @ ${d.dividend_per_share ?? 0} per share`,
          party: d.member_name || "—",
          reference: d.id?.slice(0, 8) || "—",
          amount: -d.dividend_amount,
        })),
      ]
        .filter((r) => r.date)
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      setEvents(rows);
    } finally {
      setLoading(false);
    }
  }, [money]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = events.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.party?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.reference?.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || e.type === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading audit trail...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="luxury-card rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Complete, chronological record of all institutional financial activity.
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <Input
            placeholder="Search member, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "All events" : eventLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3.5 h-3.5" />
        Read-only: audit trail records are permanent and cannot be edited or deleted.
      </div>

      <div className="luxury-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Event</th>
                <th className="p-3 font-medium">Member / Party</th>
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No audit trail entries found.
                  </td>
                </tr>
              )}
              {filtered.slice(0, 200).map((e, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{e.date}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5">
                      {e.amount >= 0 ? (
                        <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowUpCircle className="w-4 h-4 text-rose-500" />
                      )}
                      {eventLabel(e.type)}
                      <span className="text-muted-foreground">— {e.description}</span>
                    </span>
                  </td>
                  <td className="p-3">{e.party}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{e.reference}</td>
                  <td className={`p-3 text-right font-semibold ${e.amount >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {money(Math.abs(e.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        Showing {Math.min(filtered.length, 200)} of {filtered.length} entries
      </p>
    </div>
  );
}