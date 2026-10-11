import React from "react";
import { useMoney } from "@/lib/useMoney";
import { Coins } from "lucide-react";

// Live preview of how the entered amount splits across members by share holding.
export default function AllocationPreviewTable({ allocations, perShare }) {
  const { money } = useMoney();
  if (!allocations.length) return null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Member Allocation Preview</h4>
        </div>
        <span className="text-xs text-muted-foreground">
          {money(perShare, 4)} per share
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="px-5 py-3 font-medium text-muted-foreground">Member</th>
              <th className="px-5 py-3 font-medium text-muted-foreground">Shares Held</th>
              <th className="px-5 py-3 font-medium text-muted-foreground text-right">Dividend</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="px-5 py-3">
                  <span className="font-medium text-foreground">{a.member_name}</span>
                  {a.member_number && (
                    <span className="text-xs text-muted-foreground ml-2">#{a.member_number}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{money(a.share_balance)}</td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-500">
                  {money(a.dividend_amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/20 border-t border-border">
              <td className="px-5 py-3 font-semibold text-foreground">
                Total ({allocations.length} {allocations.length === 1 ? "member" : "members"})
              </td>
              <td className="px-5 py-3"></td>
              <td className="px-5 py-3 text-right font-bold text-foreground">
                {money(allocations.reduce((s, a) => s + a.dividend_amount, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}