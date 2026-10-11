import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, KeyRound, User, Mail, Building2, ShieldCheck, Coins } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { refreshCurrency } from "@/lib/useMoney";

export default function AccountSettings() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [institution, setInstitution] = useState(null);
  const [setting, setSetting] = useState(null);
  const [instForm, setInstForm] = useState({ currency: "USD", rate_normal: 12, rate_advance: 18, rate_emergency: 24, withdrawal_fee: 0 });
  const [savingInst, setSavingInst] = useState(false);
  const [instMsg, setInstMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const u = await backend.auth.me();
        setUser(u);
        const insts = await backend.entities.Institution.list().catch(() => []);
        const mine = (u && insts.find((i) => i.admin_user_id === u.id)) || insts.find((i) => i.status === "approved") || null;
        setInstitution(mine);
        if (mine) {
          const settings = await backend.entities.InstitutionSetting.list().catch(() => []);
          const s = settings.find((x) => x.institution_id === mine.id) || settings.find((x) => x.created_by_id === u?.id) || null;
          setSetting(s);
          if (s) setInstForm({ currency: s.currency || "USD", rate_normal: s.rate_normal ?? 12, rate_advance: s.rate_advance ?? 18, rate_emergency: s.rate_emergency ?? 24, withdrawal_fee: s.withdrawal_fee ?? 0 });
        }
      } catch {}
      setLoadingUser(false);
    })();
  }, []);

  const handleSaveInst = async () => {
    setSavingInst(true);
    setInstMsg("");
    try {
      if (setting) {
        await backend.entities.InstitutionSetting.update(setting.id, instForm);
      } else {
        const created = await backend.entities.InstitutionSetting.create({ ...instForm, institution_id: institution.id });
        setSetting(created);
      }
      setInstMsg("Settings saved.");
      toast({ title: "Institution settings saved", description: "Currency and loan rates updated." });
      refreshCurrency();
    } catch (e) {
      setInstMsg(e.message || "Failed to save settings.");
    } finally {
      setSavingInst(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!currentPassword) { setError("Enter your current password"); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    if (newPassword.length < 4) { setError("New password must be at least 4 characters"); return; }
    setSaving(true);
    try {
      const me = user || await backend.auth.me();
      await backend.auth.changePassword({ userId: me.id, currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
    } catch (err) {
      setError(err.message || "Failed to change password. Check your current password and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold gold-text">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and secure your account.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="luxury-card rounded-2xl p-6">
          <h2 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Profile
          </h2>
          {loadingUser ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{user.full_name || user.admin_name || "—"}</span>
              </div>
              {user.institution_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Institution:</span>
                  <span className="font-medium">{user.institution_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium capitalize">{user.role}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load profile.</p>
          )}
          <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border/40">
            Locked out? Use the <a href="/forgot-password" className="text-primary hover:underline">forgot password</a> link from the sign-in page to reset via email.
          </p>
        </div>

        {/* Change Password */}
        <div className="luxury-card rounded-2xl p-6">
          <h2 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Change Password
          </h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="pl-10 h-11" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 h-11" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11" required />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 gold-gradient text-black font-medium" disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</>) : "Update Password"}
            </Button>
          </form>
        </div>

        {/* Institution Settings */}
        <div className="luxury-card rounded-2xl p-6 lg:col-span-2">
          <h2 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" /> Institution Settings
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Set your institution's currency and the interest rates applied to each loan type. These rates are shown to members when they apply and pre-filled when you approve a loan.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Currency</Label>
              <Select value={instForm.currency} onValueChange={(v) => setInstForm({ ...instForm, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="KES">KES (KSh)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="UGX">UGX (USh)</SelectItem>
                  <SelectItem value="TZS">TZS (TSh)</SelectItem>
                  <SelectItem value="RWF">RWF (RF)</SelectItem>
                  <SelectItem value="NGN">NGN (₦)</SelectItem>
                  <SelectItem value="ZAR">ZAR (R)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordinary Loan Rate (%)</Label>
              <Input type="number" value={instForm.rate_normal} onChange={(e) => setInstForm({ ...instForm, rate_normal: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Advance Loan Rate (%)</Label>
              <Input type="number" value={instForm.rate_advance} onChange={(e) => setInstForm({ ...instForm, rate_advance: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Emergency / Top-up Rate (%)</Label>
              <Input type="number" value={instForm.rate_emergency} onChange={(e) => setInstForm({ ...instForm, rate_emergency: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Counter Withdrawal Fee</Label>
              <Input type="number" min="0" step="0.01" value={instForm.withdrawal_fee} onChange={(e) => setInstForm({ ...instForm, withdrawal_fee: Math.max(0, Number(e.target.value) || 0) })} />
              <p className="text-xs text-muted-foreground mt-1">Charged to the member's account on every counter withdrawal. 0 = no fee.</p>
            </div>
          </div>
          {instMsg && <p className="text-sm text-primary mt-3">{instMsg}</p>}
          <Button onClick={handleSaveInst} disabled={savingInst || !institution} className="mt-4 gold-gradient text-black font-medium">
            {savingInst ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : "Save Settings"}
          </Button>
          {!institution && <p className="text-xs text-muted-foreground mt-2">No institution linked to your account.</p>}
        </div>
      </div>
    </Layout>
  );
}