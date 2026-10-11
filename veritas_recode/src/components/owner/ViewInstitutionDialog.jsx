import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Mail, Phone, MapPin, FileText, User, Calendar, CreditCard, Users } from "lucide-react";
import { licenseStatus, fmtDate } from "@/lib/ownerUtils";

const Detail = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2 text-sm">
    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-medium truncate">{value || "—"}</span>
  </div>
);

export default function ViewInstitutionDialog({ open, inst, onOpenChange }) {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !inst) return;
    setLoading(true);
    Promise.all([
      backend.entities.User.list().then((all) => all.filter((u) => u.institution_id === inst.id)).catch(() => []),
      backend.entities.AuditLog.filter({ target_id: inst.id }, "-created_date", 10).catch(() => []),
    ]).then(([u, l]) => { setUsers(u); setLogs(l); }).finally(() => setLoading(false));
  }, [open, inst]);

  const lic = licenseStatus(inst);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inst?.name}</DialogTitle>
          <DialogDescription>Institution details, users and recent activity</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <Detail icon={FileText} label="Type" value={inst?.type} />
              <Detail icon={CreditCard} label="Plan" value={inst?.plan} />
              <Detail icon={Mail} label="Email" value={inst?.email} />
              <Detail icon={Phone} label="Phone" value={inst?.phone} />
              <Detail icon={MapPin} label="Address" value={inst?.physical_address} />
              <Detail icon={FileText} label="Reg #" value={inst?.registration_number} />
              <Detail icon={User} label="Admin" value={inst?.admin_name} />
              <Detail icon={Calendar} label="Joined" value={fmtDate(inst?.joined_date)} />
              <Detail icon={Calendar} label="Expiry" value={fmtDate(inst?.subscription_expiry)} />
              <Detail icon={CreditCard} label="Fee" value={inst?.subscription_fee} />
              <Detail icon={Users} label="Member limit" value={inst?.member_limit} />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className={`px-2 py-0.5 rounded-md border text-xs ${lic.color}`}>{lic.label}</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Users ({users.length})</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {users.length === 0 ? <p className="text-sm text-muted-foreground">No users linked.</p> :
                  users.map((u) => (
                    <div key={u.id} className="flex justify-between text-sm border-b border-border/40 py-1">
                      <span>{u.full_name || u.email}</span>
                      <span className="text-muted-foreground">{u.role}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Recent activity</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {logs.length === 0 ? <p className="text-sm text-muted-foreground">No activity logged.</p> :
                  logs.map((l) => (
                    <div key={l.id} className="text-sm border-b border-border/40 py-1">
                      <span className="font-medium capitalize">{l.action}</span> <span className="text-muted-foreground">— {l.description}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}