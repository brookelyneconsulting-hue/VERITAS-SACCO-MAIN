import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Settings } from "lucide-react";
import { writeAuditLog } from "@/lib/ownerUtils";
import { toast } from "@/components/ui/use-toast";

const PLANS = [["starter", "Starter"], ["professional", "Professional"]];
const PAY = [["none", "None"], ["pending", "Pending"], ["paid", "Paid"]];

export default function ManageInstitutionDialog({ open, inst, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ subscription_expiry: "", subscription_fee: 0, member_limit: 100, payment_status: "none", plan: "starter" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (inst) setForm({ subscription_expiry: inst.subscription_expiry || "", subscription_fee: inst.subscription_fee || 0, member_limit: inst.member_limit || 100, payment_status: inst.payment_status || "none", plan: inst.plan || "starter" }); }, [inst, open]); // eslint-disable-line

  const save = async () => {
    setSaving(true);
    try {
      await backend.entities.Institution.update(inst.id, {
        subscription_expiry: form.subscription_expiry || null,
        subscription_fee: Number(form.subscription_fee) || 0,
        member_limit: Number(form.member_limit) || 100,
        payment_status: form.payment_status,
        plan: form.plan,
      });
      await writeAuditLog({ action: "manage", target_id: inst.id, target_name: inst.name, description: `Updated subscription for "${inst.name}" — expiry ${form.subscription_expiry || "—"}, fee ${form.subscription_fee}, limit ${form.member_limit}, payment ${form.payment_status}.` });
      toast({ title: "Institution updated", description: inst.name });
      onOpenChange(false);
      onSaved && onSaved();
    } catch (e) { toast({ title: "Update failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Manage {inst?.name}</DialogTitle>
          <DialogDescription>Adjust subscription, fees, limits and payment status.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Label>Subscription expiry</Label><Input type="date" value={form.subscription_expiry} onChange={(e) => set("subscription_expiry", e.target.value)} /></div>
          <div><Label>Subscription fee</Label><Input type="number" value={form.subscription_fee} onChange={(e) => set("subscription_fee", e.target.value)} /></div>
          <div><Label>Member limit</Label><Input type="number" value={form.member_limit} onChange={(e) => set("member_limit", e.target.value)} /></div>
          <div><Label>Plan</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
              {PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><Label>Payment status</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.payment_status} onChange={(e) => set("payment_status", e.target.value)}>
              {PAY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gold-gradient text-black font-semibold">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}