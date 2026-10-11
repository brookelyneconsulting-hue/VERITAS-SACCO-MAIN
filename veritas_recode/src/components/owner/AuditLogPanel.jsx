import React from "react";
import { Loader2, ScrollText } from "lucide-react";
import { fmtDate } from "@/lib/ownerUtils";

export default function AuditLogPanel({ logs, loading }) {
  return (
    <div className="luxury-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="w-5 h-5 text-primary" />
        <h3 className="font-heading text-lg font-semibold">Audit Log</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 border-b border-border/40 pb-2">
              <div className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs capitalize shrink-0">{l.action}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{l.description || l.target_name}</div>
                <div className="text-xs text-muted-foreground">{l.actor_name} · {fmtDate(l.created_date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}