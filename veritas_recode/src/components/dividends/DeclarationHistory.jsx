import React from "react";
import { useMoney } from "@/lib/useMoney";
import { Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";

// Past dividend distributions, with delete (restores the bank balance).
export default function DeclarationHistory({ declarations, onDelete }) {
  const { money } = useMoney();

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Dividend History</h4>
      </div>
      {declarations.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">
          No dividends have been distributed yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Period</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Net Profit</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Amount Shared</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Total Shares</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Per Share</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Members</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Paid On</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {declarations.map((d) => (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="px-5 py-3 text-muted-foreground">
                    {d.period_start || d.period_end
                      ? `${d.period_start ? new Date(d.period_start).toLocaleDateString() : "—"} → ${d.period_end ? new Date(d.period_end).toLocaleDateString() : "—"}`
                      : "All time"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{money(d.net_profit || 0)}</td>
                  <td className="px-5 py-3 font-semibold text-foreground">{money(d.amount_to_share || 0)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{money(d.total_shares || 0)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{money(d.dividend_per_share || 0, 4)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.members_paid || 0}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {d.payment_date ? new Date(d.payment_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(d)}
                    >
                      <Trash2 className="w-4 h-4" />
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