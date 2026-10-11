import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Building2, FileText, Phone, MapPin, User, Mail, Check } from "lucide-react";
import { todayStr, addMonths, writeAuditLog } from "@/lib/ownerUtils";
import { toast } from "@/components/ui/use-toast";

const TYPES = [["sacco", "SACCO"], ["microfinance", "Microfinance"], ["credit_union", "Credit Union"], ["savings_group", "Savings Group"], ["chama", "Chama"]];
const PLAN_DEFAULTS = { starter: { fee: 50, limit: 100 }, professional: { fee: 100, limit: 1000 } };

export default function RegisterInstitutionDialog({ open, onOpenChange, onRegistered }) {
  const [form, setForm] = useState({
    name: "", type: "sacco", registration_number: "", email: "", phone: "", physical_address: "",
    plan: "starter", admin_name: "", admin_email: "", subscription_months: 12, subscription_fee: 50, member_limit: 100,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      const d = PLAN_DEFAULTS[form.plan] || PLAN_DEFAULTS.starter;
      setForm((f) => ({ ...f, subscription_fee: d.fee, member_limit: d.limit }));
    }
  }, [open]); // eslint-disable-line

  const choosePlan = (p) => {
    const d = PLAN_DEFAULTS[p];
    setForm((f) => ({ ...f, plan: p, subscription_fee: d.fee, member_limit: d.limit }));
  };

  const submit = async () => {
    if (!form.name || !form.email) { toast({ title: "Institution name and email are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const start = todayStr();
      const inst = await backend.entities.Institution.create({
        name: form.name, type: form.type, registration_number: form.registration_number,
        email: form.email, phone: form.phone, physical_address: form.physical_address,
        plan: form.plan, admin_name: form.admin_name, status: "approved", joined_date: start,
        subscription_start: start, subscription_expiry: addMonths(start, Number(form.subscription_months) || 12),
        subscription_fee: Number(form.subscription_fee) || 0, member_limit: Number(form.member_limit) || 100,
        payment_status: "pending",
      });
      // Invite + link the institution admin
      if (form.admin_email) {
        try {
          await backend.users.inviteUser(form.admin_email, "institution_admin");
          const allUsers = await backend.entities.User.list();
          const admin = allUsers.find((u) => u.email === form.admin_email);
          if (admin) {
            await backend.entities.User.update(admin.id, {
              institution_id: inst.id, institution_name: form.name, account_status: "approved",
            });
            await backend.entities.Institution.update(inst.id, { admin_user_id: admin.id, admin_name: form.admin_name || admin.full_name || "" });
          }
        } catch (e) { console.warn("admin invite/link failed", e); }
      }
      await writeAuditLog({ action: "register", target_id: inst.id, target_name: form.name, description: `Registered institution "${form.name}" (${form.plan}, ${form.subscription_months} months).` });
      toast({ title: "Institution registered", description: `${form.name} is now active. The admin has been emailed an invite.` });
      onOpenChange(false);
      onRegistered && onRegistered();
    } catch (e) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Register Institution</DialogTitle>
          <DialogDescription>Create and pre-approve an institution. The admin receives an email invite to set up their account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Label className="text-xs uppercase text-muted-foreground">Institution Details</Label>
          <div className="space-y-2">
            <Label htmlFor="ri-name">Institution Name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="ri-name" placeholder="e.g. Sunrise SACCO" value={form.name} onChange={(e) => set("name", e.target.value)} className="pl-10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ri-type">Institution Type</Label>
              <select id="ri-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ri-reg">Reg. Number</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="ri-reg" placeholder="SAS/1234" value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} className="pl-10" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ri-phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="ri-phone" placeholder="+254 712 345 678" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ri-addr">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="ri-addr" placeholder="Nairobi, Kenya" value={form.physical_address} onChange={(e) => set("physical_address", e.target.value)} className="pl-10" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ri-email">Institution Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="ri-email" type="email" placeholder="info@sacco.com" value={form.email} onChange={(e) => set("email", e.target.value)} className="pl-10" />
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <Label className="text-xs uppercase text-muted-foreground">Choose Your Plan</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["starter", "professional"]).map((p) => (
                <button key={p} type="button" onClick={() => choosePlan(p)} className={`text-left p-4 rounded-xl border transition-all ${form.plan === p ? "border-primary gold-glow bg-primary/5" : "border-input hover:border-border"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold capitalize">{p}</span>
                    {form.plan === p && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="font-heading text-2xl font-bold gold-text mt-1">${PLAN_DEFAULTS[p].fee}<span className="text-sm text-muted-foreground font-body">/year</span></div>
                  <p className="text-xs text-muted-foreground mt-1">Up to {PLAN_DEFAULTS[p].limit} members</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Administrator Account</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ri-aname">Admin Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="ri-aname" placeholder="John Doe" value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} className="pl-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ri-aemail">Admin Email (login)</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="ri-aemail" type="email" placeholder="admin@sacco.com" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} className="pl-10" />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Subscription</Label>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Months</Label><Input type="number" value={form.subscription_months} onChange={(e) => set("subscription_months", e.target.value)} /></div>
              <div><Label>Fee</Label><Input type="number" value={form.subscription_fee} onChange={(e) => set("subscription_fee", e.target.value)} /></div>
              <div><Label>Member limit</Label><Input type="number" value={form.member_limit} onChange={(e) => set("member_limit", e.target.value)} /></div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gold-gradient text-black font-semibold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Register & Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}