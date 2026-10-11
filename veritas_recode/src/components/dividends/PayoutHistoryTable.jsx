import React, { useEffect, useState, useMemo } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import { useMoney } from "@/lib/useMoney";
import { ReceiptText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Chronological log of every dividend payment made to members.
export default function PayoutHistoryTable({ reloadKey }) {
  const { money } = useMoney();
  const [payments, setPayments] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    backend.entities.DividendPayment.list("-payment_date")
      .then(scoped)
      .catch(() => [])
      .then((list) => { if (alive) setPayments(list); });
    return () => { alive = false; };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = payments || [];
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.member_name || "").toLowerCase().includes(q) ||
        (p.member_number || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  const total = filtered.reduce((s, p) => s + (p.dividend_amount || 0), 0);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 bg-muted/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Payout History Log</h4>
          {payments !== null && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "payout" : "payouts"} · {money(total)} distributed
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-full sm:w-56"
          />
        </div>
      </div>
      {payments === null ? (
        <p className="p-6 text-sm text-muted-foreground text-center">Loading payout log...</p>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">
          {search ? "No payouts match your search." : "No dividend payouts have been made yet."}
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Member</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Shares Held</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Per Share</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="px-5 py-3 text-muted-foreground">
                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    <span className="font-medium">{p.member_name}</span>
                    {p.member_number && (
                      <span className="text-muted-foreground text-xs ml-2">{p.member_number}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{money(p.share_balance || 0)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{money(p.dividend_per_share || 0, 4)}</td>
                  <td className="px-5 py-3 font-semibold text-foreground text-right">
                    {money(p.dividend_amount || 0)}
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