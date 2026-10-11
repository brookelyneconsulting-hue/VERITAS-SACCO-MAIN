import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Check } from "lucide-react";
import { todayStr, addMonths, writeAuditLog } from "@/lib/ownerUtils";
import { toast } from "@/components/ui/use-toast";

export default function ApproveInstitutionDialog({ open, inst, onOpenChange, onDone }) {
  const [months, setMonths] = useState(12);
  const [fee, setFee] = useState(50);
  const [limit, setLimit] = useState(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (inst) { setMonths(12); setFee(inst.plan === "professional" ? 100 : 50); setLimit(inst.member_limit || 100); } }, [inst, open]); // eslint-disable-line

  const approve = async () => {
    setSaving(true);
    try {
      const start = todayStr();
      await backend.entities.Institution.update(inst.id, {
        status: "approved", admin_reason: "", joined_date: inst.joined_date || start,
        subscription_start: start, subscription_expiry: addMonths(start, Number(months) || 12),
        subscription_fee: Number(fee) || 0, member_limit: Number(limit) || 100, payment_status: "pending",
      });
      // Grant the institution's admin portal access: flip their account status to
      // "approved" so the ProtectedRoute gate lets them into the dashboard.
      if (inst.admin_user_id) {
        try {
          await backend.entities.User.update(inst.admin_user_id, {
            account_status: "approved",
            // Give the institution admin full console access ("user" role sees no modules)
            role: "institution_admin",
            institution_id: inst.id,
            institution_name: inst.name,
          });
        } catch (e) {
          console.warn("Could not update user account status:", e);
          toast({
            title: "Approval saved, but admin access may be delayed",
            description: `"${inst.name}" is approved, but the admin user's account status could not be updated. Set it to "approved" from the User Management page.`,
            variant: "destructive",
          });
        }
      }
      try {
        await backend.integrations.Core.SendEmail({ to: inst.email, from_name: "Brooke Veritas", subject: `Your institution has been approved — ${inst.name}`, body: `Hello ${inst.admin_name || "Admin"},\n\nYour institution "${inst.name}" has been approved on the Brooke Veritas platform. Your subscription is active for ${months} months.\n\nLog in at: ${window.location.origin}/login\n\nWelcome aboard,\nThe Brooke Veritas Team` });
      } catch (e) { console.warn(e); }
      await writeAuditLog({ action: "approve", target_id: inst.id, target_name: inst.name, description: `Approved "${inst.name}" — ${months} month subscription, fee ${fee}.` });
      toast({ title: "Institution approved", description: inst.name });
      onOpenChange(false);
      onDone && onDone();
    } catch (e) { toast({ title: "Approval failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Check className="w-5 h-5 text-emerald-400" /> Approve {inst?.name}</DialogTitle>
          <DialogDescription>Set the initial subscription before activating this institution.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3"><Label>Subscription period (months)</Label><Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} /></div>
          <div><Label>Fee</Label><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
          <div className="col-span-2"><Label>Member limit</Label><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={approve} disabled={saving} className="gold-gradient text-black font-semibold">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Confirm Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}