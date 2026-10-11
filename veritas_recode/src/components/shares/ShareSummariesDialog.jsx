import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { useMoney } from "@/lib/useMoney";
import { exportToCSV } from "@/lib/csvExport";

// Summaries of how shares have been contributed / received from member payments,
// plus share transfers & redemptions. Visible and downloadable as CSV.
export default function ShareSummariesDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const { money } = useMoney();

  const load = async () => {
    setLoading(true);
    try {
      const [memberPayments, shareTxns] = await Promise.all([
        backend.entities.MemberPayment.list("-payment_date"),
        backend.entities.ShareTransaction.list("-date"),
      ]);
      const contributions = memberPayments
        .filter((p) => p.payment_type === "shares")
        .map((p) => ({
          date: p.payment_date || "",
          member: p.member_name || "",
          number: p.member_number || "",
          kind: "Share Contribution",
          reference: p.payment_ref || "",
          amount: p.amount || 0,
          status: p.status || "",
        }));
      const txns = shareTxns.map((t) => ({
        date: t.date || "",
        member: t.from_member_name || t.to_member_name || "",
        number: "",
        kind:
          t.type === "transfer" ? "Share Transfer"
            : t.type === "contribution" ? "Share Contribution"
            : "Share Redemption",
        reference: t.reference || "",
        amount: t.amount || 0,
        status: t.status || "",
      }));
      const merged = [...contributions, ...txns].sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      );
      setRows(merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const isCredit = (r) =>
    (r.kind === "Share Contribution" && (r.status === "approved" || r.status === "completed")) ||
    (r.kind === "Share Transfer" && r.status === "completed");

  const totalContributions = rows
    .filter((r) => r.kind === "Share Contribution" && (r.status === "approved" || r.status === "completed"))
    .reduce((s, r) => s + r.amount, 0);
  const totalTransfers = rows
    .filter((r) => r.kind === "Share Transfer" && r.status === "completed")
    .reduce((s, r) => s + r.amount, 0);
  const totalRedemptions = rows
    .filter((r) => r.kind === "Share Redemption" && r.status === "completed")
    .reduce((s, r) => s + r.amount, 0);

  const handleDownload = () => {
    exportToCSV(
      rows.map((r) => ({
        Date: r.date, Member: r.member, Member_Number: r.number, Type: r.kind,
        Reference: r.reference, Amount: r.amount, Status: r.status,
      })),
      "share-contribution-summary.csv",
      ["Date", "Member", "Member_Number", "Type", "Reference", "Amount", "Status"]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BarChart3 className="w-4 h-4 mr-2" />
          Summaries
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Contribution Summaries</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="grid grid-cols-3 gap-3 flex-1">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Contributions</p>
              <p className="text-lg font-bold text-emerald-500">{money(totalContributions)}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Transfers</p>
              <p className="text-lg font-bold text-blue-500">{money(totalTransfers)}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Redemptions</p>
              <p className="text-lg font-bold text-amber-500">{money(totalRedemptions)}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleDownload} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-2" />Download CSV
          </Button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No share transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2">Date</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2">Member</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2">Type</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Reference</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2">Status</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-2 text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-foreground font-medium">{r.member || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.kind}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{r.reference || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.status || "—"}</td>
                    <td className={`px-3 py-2 text-right font-medium ${isCredit(r) ? "text-emerald-500" : "text-amber-500"}`}>
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}