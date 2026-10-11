import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Loader2, CalendarClock } from "lucide-react";
import { useMoney, moneyNow } from "@/lib/useMoney";

const addMonth = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

// Printable per-member share schedule: recorded, auto-deducted and paid-in shares
// plus a monthly contribution projection.
export default function MemberShareSchedule({ memberId, memberName, onClose }) {
  const { money, symbol } = useMoney();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [rows, setRows] = useState([]);
  const [recorded, setRecorded] = useState(0);
  const [autoDeducted, setAutoDeducted] = useState(0);
  const [paidIn, setPaidIn] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [shareList, schedList, txns, payments] = await Promise.all([
          backend.entities.Share.list(),
          backend.entities.ShareSchedule.list(),
          backend.entities.ShareTransaction.list(),
          backend.entities.MemberPayment.list(),
        ]);
        const sh = shareList.find((s) => s.member_id === memberId);
        setShare(sh);
        const memberSchedules = schedList.filter((s) => s.member_id === memberId);
        setSchedules(memberSchedules);

        const memberTxns = txns.filter((t) => t.from_member_id === memberId);
        const auto = memberTxns
          .filter((t) => t.type === "contribution" && t.reference && t.reference.startsWith("SCH-"))
          .reduce((s, t) => s + (t.amount || 0), 0);
        setAutoDeducted(auto);

        const memberSharePayments = payments.filter((p) => p.member_id === memberId && p.payment_type === "shares");
        const paid = memberSharePayments
          .filter((p) => p.status === "approved")
          .reduce((s, p) => s + (p.amount || 0), 0);
        setPaidIn(paid);
        setRecorded(sh?.balance || 0);

        // Applied months keyed YYYYMM from SCH- references
        const appliedKeys = new Set(
          memberTxns
            .filter((t) => t.reference && t.reference.startsWith("SCH-"))
            .map((t) => t.reference.slice(4, 10))
        );

        // Build monthly projection from earliest schedule start to today + 12 months
        const today = new Date().toISOString().slice(0, 10);
        const projection = [];
        if (memberSchedules.length > 0) {
          const earliest = memberSchedules
            .map((s) => s.start_date)
            .sort()[0];
          let cursor = earliest;
          const limit = new Date();
          limit.setFullYear(limit.getFullYear() + 1);
          const limitStr = limit.toISOString().slice(0, 10);
          let i = 0;
          while (cursor <= limitStr && i < 60) {
            const ym = cursor.slice(0, 7).replace("-", "");
            const amount = memberSchedules
              .filter((s) => s.status === "active" && s.start_date <= cursor)
              .reduce((sum, s) => sum + (s.monthly_amount || 0), 0);
            let status = "Scheduled";
            if (appliedKeys.has(ym)) status = "Applied";
            else if (cursor < today) status = "Due";
            projection.push({ date: cursor, amount, status });
            cursor = addMonth(cursor);
            i++;
          }
        }
        setRows(projection);
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId]);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const monthlyTotal = schedules
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.monthly_amount || 0), 0);

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const summaryRows = [
      ["Recorded Shares (current balance)", moneyNow(recorded)],
      ["Auto-Deducted Shares (from schedules)", moneyNow(autoDeducted)],
      ["Paid-In Shares (approved payments)", moneyNow(paidIn)],
    ];
    const scheduleRowsHtml = rows
      .map(
        (r) => `<tr>
          <td>${fmtDate(r.date)}</td>
          <td style="text-align:right">${moneyNow(r.amount)}</td>
          <td>${r.status}</td>
        </tr>`
      )
      .join("");
    const summaryHtml = summaryRows
      .map(
        ([label, val]) => `<tr><td style="padding:6px 10px">${label}</td><td style="padding:6px 10px;text-align:right;font-weight:bold">${val}</td></tr>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Share Schedule — ${memberName}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color:#1a1a1a; padding:24px; }
        h1 { font-size:20px; margin:0 0 4px; }
        h2 { font-size:14px; margin:18px 0 6px; color:#555; text-transform:uppercase; letter-spacing:0.05em; }
        .meta { color:#666; font-size:13px; margin-bottom:12px; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th, td { border:1px solid #ddd; padding:6px 10px; text-align:left; }
        th { background:#f5f5f5; }
        .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; }
        .applied { background:#dcfce7; color:#166534; }
        .due { background:#fef9c3; color:#854d0e; }
        .scheduled { background:#e2e8f0; color:#475569; }
        @media print { body { padding:0; } }
      </style></head><body>
      <h1>Share Contribution Schedule</h1>
      <div class="meta">Member: <strong>${memberName}</strong> · Monthly contribution: <strong>${moneyNow(monthlyTotal)}</strong> · Generated: ${new Date().toLocaleString()}</div>
      <h2>Share Summary</h2>
      <table><tbody>${summaryHtml}</tbody></table>
      <h2>Monthly Contribution Schedule</h2>
      <table>
        <thead><tr><th>Due Date</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
        <tbody>
          ${scheduleRowsHtml || '<tr><td colspan="3">No schedule set up.</td></tr>'}
        </tbody>
      </table>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Share Schedule — {memberName}</DialogTitle>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading}>
              <Printer className="w-4 h-4 mr-2" /> Print Schedule
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Recorded Shares</p>
                <p className="text-lg font-bold text-foreground">{money(recorded)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Auto-Deducted Shares</p>
                <p className="text-lg font-bold text-emerald-500">{money(autoDeducted)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Paid-In Shares</p>
                <p className="text-lg font-bold text-primary">{money(paidIn)}</p>
              </div>
            </div>

            {/* Schedule projection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-foreground">Monthly Contribution Schedule</h4>
                <span className="ml-auto text-xs text-muted-foreground">
                  Monthly: {money(monthlyTotal)} · {schedules.filter((s) => s.status === "active").length} active schedule(s)
                </span>
              </div>
              {rows.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground rounded-xl border border-border">
                  No contribution schedule set up for this member yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left font-medium text-muted-foreground px-3 py-2">Due Date</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                        <th className="text-left font-medium text-muted-foreground px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">{money(r.amount)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.status === "Applied" ? "bg-emerald-950/40 text-emerald-400"
                              : r.status === "Due" ? "bg-amber-950/40 text-amber-400"
                              : "bg-muted text-muted-foreground"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}