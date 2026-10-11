import React from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Ban, RotateCcw, Settings, Eye, RefreshCw, KeyRound, Building2 } from "lucide-react";
import { licenseStatus, fmtDate } from "@/lib/ownerUtils";

const typeLabel = (t) => ({ sacco: "SACCO", microfinance: "Microfinance", credit_union: "Credit Union", savings_group: "Savings Group", chama: "Chama" })[t] || t;
const payLabel = { none: "—", pending: "Pending", paid: "Paid" };
const payColor = { none: "text-muted-foreground", pending: "bg-amber-500/10 text-amber-400", paid: "bg-emerald-500/10 text-emerald-400" };

export default function InstitutionTable({ institutions, users, processingId, onApprove, onReject, onSuspend, onReactivate, onManage, onView, onRenew, onResetAccess }) {
  const userCount = (instId) => users.filter((u) => u.institution_id === instId).length;

  return (
    <div className="luxury-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10">
            <tr>
              <th className="text-left text-xs uppercase text-muted-foreground font-medium px-5 py-3">Institution</th>
              <th className="text-left text-xs uppercase text-muted-foreground font-medium px-5 py-3 hidden lg:table-cell">Admin</th>
              <th className="text-left text-xs uppercase text-muted-foreground font-medium px-5 py-3">Status</th>
              <th className="text-left text-xs uppercase text-muted-foreground font-medium px-5 py-3 hidden md:table-cell">License / Expiry</th>
              <th className="text-left text-xs uppercase text-muted-foreground font-medium px-5 py-3 hidden xl:table-cell">Payment</th>
              <th className="text-left text-xs uppercase text-muted-foreground font-medium px-5 py-3 hidden lg:table-cell">Users</th>
              <th className="text-right text-xs uppercase text-muted-foreground font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((inst) => {
              const lic = licenseStatus(inst);
              const busy = processingId === inst.id;
              return (
                <tr key={inst.id} className="border-b border-border/50 hover:bg-muted/5">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{inst.name}</div>
                        <div className="text-xs text-muted-foreground">{typeLabel(inst.type)}{inst.plan ? ` · ${inst.plan}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">
                    <div>{inst.admin_name || "—"}</div>
                    <div className="text-xs">{inst.email || ""}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md border text-xs ${lic.color}`}>{lic.label}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{fmtDate(inst.subscription_expiry)}</td>
                  <td className="px-5 py-3.5 hidden xl:table-cell">
                    <span className={`px-2 py-0.5 rounded-md text-xs ${payColor[inst.payment_status] || payColor.none}`}>{payLabel[inst.payment_status] || "—"}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{userCount(inst.id)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {inst.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-300 h-8" disabled={busy} onClick={() => onApprove(inst)}><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-8" disabled={busy} onClick={() => onReject(inst)}><X className="w-3.5 h-3.5 mr-1" />Reject</Button>
                        </>
                      )}
                      {lic.key === "active" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-amber-400 hover:bg-amber-500/10" disabled={busy} onClick={() => onSuspend(inst)}><Ban className="w-3.5 h-3.5 mr-1" />Suspend</Button>
                          <Button size="sm" variant="ghost" className="h-8 text-blue-400 hover:bg-blue-500/10" disabled={busy} onClick={() => onRenew(inst)}><RefreshCw className="w-3.5 h-3.5 mr-1" />Renew</Button>
                        </>
                      )}
                      {inst.status === "suspended" && (
                        <Button size="sm" variant="ghost" className="h-8 text-emerald-400 hover:bg-emerald-500/10" disabled={busy} onClick={() => onReactivate(inst)}><RotateCcw className="w-3.5 h-3.5 mr-1" />Reactivate</Button>
                      )}
                      {lic.key === "expired" && (
                        <Button size="sm" variant="ghost" className="h-8 text-blue-400 hover:bg-blue-500/10" disabled={busy} onClick={() => onRenew(inst)}><RefreshCw className="w-3.5 h-3.5 mr-1" />Renew</Button>
                      )}
                      {(inst.status === "approved" || inst.status === "suspended") && (
                        <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => onManage(inst)}><Settings className="w-3.5 h-3.5 mr-1" />Manage</Button>
                      )}
                      {inst.status === "approved" && (
                        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-foreground" disabled={busy} onClick={() => onResetAccess(inst)} title="Reset admin access"><KeyRound className="w-3.5 h-3.5" /></Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-foreground" onClick={() => onView(inst)}><Eye className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}