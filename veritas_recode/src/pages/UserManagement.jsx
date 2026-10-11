import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserCog, UserPlus, Loader2, Shield, Mail, Trash2, ChevronDown, Check
} from "lucide-react";
import Layout from "@/components/Layout";
import { ROLES, isPlatformAdmin } from "@/lib/roles";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("front_office");
  const [inviting, setInviting] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [me, allUsers] = await Promise.all([
        backend.auth.me(),
        backend.entities.User.list(),
      ]);
      setCurrentUser(me);
      // Filter to this institution's users (platform admin sees all)
      const filtered = isPlatformAdmin(me)
        ? allUsers
        : allUsers.filter((u) => u.institution_id === me.institution_id);
      setUsers(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await backend.users.inviteUser(inviteEmail, inviteRole);
      toast({ title: "Invitation sent", description: `${inviteEmail} has been invited as ${ROLES[inviteRole]?.label}.` });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("front_office");
      await load();
    } catch (err) {
      toast({ title: "Invitation failed", description: err.message || "Could not send invitation", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await backend.entities.User.update(userId, { role: newRole });
      toast({ title: "Role updated", description: `User is now ${ROLES[newRole]?.label}.` });
      await load();
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (u) => {
    if (!u.institution_id) { toast({ title: "No institution linked to this user", variant: "destructive" }); return; }
    setApprovingId(u.id);
    try {
      const inst = await backend.entities.Institution.get(u.institution_id);
      const start = new Date().toISOString().split("T")[0];
      const exp = new Date(start); exp.setMonth(exp.getMonth() + 12);
      await backend.entities.Institution.update(u.institution_id, {
        status: "approved", admin_reason: "", joined_date: inst.joined_date || start,
        subscription_start: start, subscription_expiry: exp.toISOString().split("T")[0],
        subscription_fee: inst.subscription_fee || (inst.plan === "professional" ? 100 : 50),
        member_limit: inst.member_limit || 100, payment_status: "pending",
        admin_user_id: u.id, admin_name: u.full_name || u.email,
      });
      await backend.entities.User.update(u.id, { account_status: "approved", institution_name: inst.name, role: (!u.role || u.role === "user") ? "institution_admin" : u.role });
      try {
        await backend.integrations.Core.SendEmail({ to: u.email, from_name: "Brooke Veritas", subject: `Approved — ${inst.name}`, body: `Hello ${u.full_name || ""},\n\nYour institution "${inst.name}" has been approved on the Brooke Veritas platform.\n\nLog in at: ${window.location.origin}/login\n\nThe Brooke Veritas Team` });
      } catch (e) { console.warn(e); }
      toast({ title: "Institution approved", description: inst.name });
      await load();
    } catch (e) { toast({ title: "Approval failed", description: e.message, variant: "destructive" }); }
    finally { setApprovingId(null); }
  };

  const roleColor = (role) => ({
    admin: "bg-primary/10 text-primary border-primary/30",
    institution_admin: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    accountant: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    front_office: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    member: "bg-muted/30 text-muted-foreground border-border",
  })[role] || "bg-muted/30 text-muted-foreground border-border";

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center">
            <UserCog className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold gold-text">User Management</h1>
            <p className="text-sm text-muted-foreground">Assign roles and manage team access</p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gold-gradient text-black font-semibold">
          <UserPlus className="w-4 h-4 mr-1" /> Invite User
        </Button>
      </div>

      {/* Role legend */}
      <div className="luxury-card rounded-2xl p-5 mb-6">
        <p className="text-xs uppercase text-muted-foreground mb-3">Available Roles</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ROLES).filter(([k]) => k !== "member" && k !== "admin").map(([key, r]) => (
            <div key={key} className={`px-3 py-2 rounded-lg border text-xs ${roleColor(key)}`}>
              <span className="font-semibold">{r.label}</span>
              <span className="text-muted-foreground ml-2">— {r.description}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : users.length === 0 ? (
        <div className="luxury-card rounded-2xl p-12 text-center">
          <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No users found. Invite team members to get started.</p>
        </div>
      ) : (
        <div className="luxury-card rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/10">
              <tr>
                <th className="text-left text-xs uppercase text-muted-foreground font-medium px-6 py-3">Name</th>
                <th className="text-left text-xs uppercase text-muted-foreground font-medium px-6 py-3">Email</th>
                <th className="text-left text-xs uppercase text-muted-foreground font-medium px-6 py-3">Institution</th>
                <th className="text-left text-xs uppercase text-muted-foreground font-medium px-6 py-3">Role</th>
                <th className="text-left text-xs uppercase text-muted-foreground font-medium px-6 py-3">Status</th>
                <th className="text-left text-xs uppercase text-muted-foreground font-medium px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/5">
                  <td className="px-6 py-3 text-sm font-medium">{u.full_name || u.email}</td>
                  <td className="px-6 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-6 py-3 text-sm text-muted-foreground">{u.institution_name || (isPlatformAdmin(u) ? "Platform" : "—")}</td>
                  <td className="px-6 py-3">
                    {u.id === currentUser?.id || isPlatformAdmin(u) ? (
                      <span className={`px-2 py-1 rounded-md border text-xs ${roleColor(u.role)}`}>
                        {ROLES[u.role]?.label || u.role}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-transparent border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="institution_admin">Admin</option>
                        <option value="accountant">Accountant</option>
                        <option value="front_office">Front Office</option>
                        <option value="member">Member</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs border ${
                      u.account_status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                      u.account_status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/30" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}>
                      {u.account_status || (isPlatformAdmin(u) ? "approved" : "pending")}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {isPlatformAdmin(currentUser) && u.institution_id && u.account_status !== "approved" ? (
                      <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10 h-8" disabled={approvingId === u.id} onClick={() => handleApprove(u)}>
                        {approvingId === u.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}Approve
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your institution. They will receive an email to set up their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="inviteEmail" type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <select
                id="inviteRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="institution_admin">Admin — Full access to institution data</option>
                <option value="accountant">Accountant — Accounting & payments</option>
                <option value="front_office">Front Office — Members, loans & shares</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting} className="gold-gradient text-black font-semibold">
              {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}