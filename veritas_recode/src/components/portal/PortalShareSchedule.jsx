import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { CalendarClock, Printer, Loader2 } from "lucide-react";
import { useMoney, moneyNow } from "@/lib/useMoney";

const addMonth = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

// Portal-themed printable share schedule: recorded, auto-deducted & paid-in shares
// plus a monthly contribution projection.
export default function PortalShareSchedule({ memberId, memberName, share, memberPayments }) {
  const { money } = useMoney();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [rows, setRows] = useState([]);
  const [recorded, setRecorded] = useState(0);
  const [autoDeducted, setAutoDeducted] = useState(0);
  const [paidIn, setPaidIn] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [schedList, txns] = await Promise.all([
          backend.entities.ShareSchedule.filter({ member_id: memberId }),
          backend.entities.ShareTransaction.filter({ from_member_id: memberId }),
        ]);
        const memberSchedules = schedList || [];
        setSchedules(memberSchedules);

        const auto = (txns || [])
          .filter((t) => t.reference && t.reference.startsWith("SCH-"))
          .reduce((s, t) => s + (t.amount || 0), 0);
        setAutoDeducted(auto);

        const paid = (memberPayments || [])
          .filter((p) => p.payment_type === "shares" && p.status === "approved")
          .reduce((s, p) => s + (p.amount || 0), 0);
        setPaidIn(paid);
        setRecorded(share?.balance || 0);

        const appliedKeys = new Set(
          (txns || [])
            .filter((t) => t.reference && t.reference.startsWith("SCH-"))
            .map((t) => t.reference.slice(4, 10))
        );

        const today = new Date().toISOString().slice(0, 10);
        const projection = [];
        if (memberSchedules.length > 0) {
          const earliest = memberSchedules.map((s) => s.start_date).sort()[0];
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
  }, [memberId, share, memberPayments]);

  const monthlyTotal = schedules
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.monthly_amount || 0), 0);
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const badge = (st) =>
    st === "Applied"
      ? "bg-emerald-950/50 text-emerald-400"
      : st === "Due"
      ? "bg-amber-950/50 text-amber-400"
      : "bg-slate-800 text-slate-400";

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const summaryRows = [
      ["Recorded Shares (current balance)", moneyNow(recorded)],
      ["Auto-Deducted Shares (from schedules)", moneyNow(autoDeducted)],
      ["Paid-In Shares (approved payments)", moneyNow(paidIn)],
    ];
    const scheduleRowsHtml = rows
      .map((r) => `<tr><td>${fmt(r.date)}</td><td style="text-align:right">${moneyNow(r.amount)}</td><td>${r.status}</td></tr>`)
      .join("");
    const summaryHtml = summaryRows
      .map(([l, v]) => `<tr><td style="padding:6px 10px">${l}</td><td style="padding:6px 10px;text-align:right;font-weight:bold">${v}</td></tr>`)
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Share Schedule — ${memberName}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color:#1a1a1a; padding:24px; }
        h1 { font-size:20px; margin:0 0 4px; }
        h2 { font-size:13px; margin:18px 0 6px; color:#555; text-transform:uppercase; letter-spacing:0.05em; }
        .meta { color:#666; font-size:13px; margin-bottom:12px; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th, td { border:1px solid #ddd; padding:6px 10px; text-align:left; }
        th { background:#f5f5f5; }
      </style></head><body>
      <h1>Share Contribution Schedule</h1>
      <div class="meta">Member: <strong>${memberName}</strong> · Monthly contribution: <strong>${moneyNow(monthlyTotal)}</strong> · Generated: ${new Date().toLocaleString()}</div>
      <h2>Share Summary</h2>
      <table><tbody>${summaryHtml}</tbody></table>
      <h2>Monthly Contribution Schedule</h2>
      <table><thead><tr><th>Due Date</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
        <tbody>${scheduleRowsHtml || '<tr><td colspan="3">No schedule set up.</td></tr>'}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-amber-800/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-amber-100">My Share Schedule</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading}
          className="border-amber-700/50 text-amber-400 hover:bg-amber-950/30">
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800/40 rounded-xl p-3 border border-amber-800/10">
              <p className="text-xs text-slate-400">Recorded Shares</p>
              <p className="text-lg font-bold text-amber-100">{money(recorded)}</p>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-3 border border-amber-800/10">
              <p className="text-xs text-slate-400">Auto-Deducted</p>
              <p className="text-lg font-bold text-emerald-400">{money(autoDeducted)}</p>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-3 border border-amber-800/10">
              <p className="text-xs text-slate-400">Paid-In Shares</p>
              <p className="text-lg font-bold text-amber-400">{money(paidIn)}</p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No contribution schedule set up for you yet. Your institution can set up a monthly contribution.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-amber-800/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-800/10 bg-slate-800/30">
                    <th className="text-left font-medium text-slate-400 px-3 py-2">Due Date</th>
                    <th className="text-right font-medium text-slate-400 px-3 py-2">Amount</th>
                    <th className="text-left font-medium text-slate-400 px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-amber-800/5">
                      <td className="px-3 py-2 text-slate-400">{fmt(r.date)}</td>
                      <td className="px-3 py-2 text-right font-medium text-amber-100">{money(r.amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge(r.status)}`}>
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
      )}
    </div>
  );
}