import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { HandCoins } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

// Member portal section: dividends this member has received.
export default function PortalDividends({ memberId }) {
  const { money } = useMoney();
  const [dividends, setDividends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    const load = async () => {
      try {
        const list = await backend.entities.DividendPayment.filter({ member_id: memberId }, "-payment_date");
        setDividends(list || []);
      } catch {
        setDividends([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    let unsub;
    try { unsub = backend.entities.DividendPayment.subscribe(load); } catch {}
    return () => { if (unsub) unsub(); };
  }, [memberId]);

  const total = dividends.reduce((s, d) => s + (d.dividend_amount || 0), 0);

  return (
    <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-amber-800/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-amber-100">My Dividends</h3>
        </div>
        {total > 0 && (
          <span className="text-sm font-bold text-emerald-400">Total: {money(total)}</span>
        )}
      </div>
      {loading ? (
        <p className="p-5 text-sm text-slate-400">Loading dividends...</p>
      ) : dividends.length === 0 ? (
        <p className="p-5 text-sm text-slate-400">
          No dividends have been issued to you yet. Dividends appear here once your institution shares its net profits.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-amber-800/10">
                <th className="text-left font-medium text-slate-400 px-5 py-3">Date Paid</th>
                <th className="text-right font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Shares Held</th>
                <th className="text-right font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Dividend / Share</th>
                <th className="text-right font-medium text-slate-400 px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d) => (
                <tr key={d.id} className="border-b border-amber-800/5">
                  <td className="px-5 py-3.5 text-amber-100">
                    {d.payment_date ? new Date(d.payment_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-400 hidden sm:table-cell">
                    {money(d.share_balance || 0)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-400 hidden sm:table-cell">
                    {money(d.dividend_per_share || 0, 4)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-400">
                    {money(d.dividend_amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="bg-slate-800/30 border-t-2 border-amber-800/20">
                  <td className="px-5 py-3 font-semibold text-amber-100">Total</td>
                  <td className="px-5 py-3 hidden sm:table-cell"></td>
                  <td className="px-5 py-3 hidden sm:table-cell"></td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-400">{money(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}