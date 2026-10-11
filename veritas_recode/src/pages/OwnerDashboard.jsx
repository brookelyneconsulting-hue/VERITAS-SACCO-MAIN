import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Shield, Search, Plus, Loader2, Building2 } from "lucide-react";
import Layout from "@/components/Layout";
import { isPlatformAdmin } from "@/lib/roles";
import { licenseStatus, isExpiringSoon, addMonths, todayStr, writeAuditLog } from "@/lib/ownerUtils";
import { toast } from "@/components/ui/use-toast";
import OwnerStatCards from "@/components/owner/OwnerStatCards";
import InstitutionTable from "@/components/owner/InstitutionTable";
import RegisterInstitutionDialog from "@/components/owner/RegisterInstitutionDialog";
import ApproveInstitutionDialog from "@/components/owner/ApproveInstitutionDialog";
import ManageInstitutionDialog from "@/components/owner/ManageInstitutionDialog";
import ViewInstitutionDialog from "@/components/owner/ViewInstitutionDialog";
import AuditLogPanel from "@/components/owner/AuditLogPanel";

const FILTERS = [
  { key: "all", label: "All" }, { key: "pending", label: "Pending" }, { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" }, { key: "expired", label: "Expired" },
  { key: "rejected", label: "Rejected" }, { key: "expiring", label: "Expiring" },
];

export default function OwnerDashboard() {
  const [institutions, setInstitutions] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [processingId, setProcessingId] = useState(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [approveInst, setApproveInst] = useState(null);
  const [manageInst, setManageInst] = useState(null);
  const [viewInst, setViewInst] = useState(null);
  const [rejectInst, setRejectInst] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const me = await backend.auth.me();
      if (!isPlatformAdmin(me)) { setDenied(true); return; }
      const [insts, allUsers, allLogs] = await Promise.all([
        backend.entities.Institution.list("-created_date"),
        backend.entities.User.list().catch(() => []),
        backend.entities.AuditLog.list("-created_date", 50).catch(() => []),
      ]);
      setInstitutions(insts); setUsers(allUsers); setLogs(allLogs);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = institutions.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q) || i.admin_name?.toLowerCase().includes(q);
    const lic = licenseStatus(i);
    let matchFilter = true;
    if (filter === "expiring") matchFilter = isExpiringSoon(i);
    else if (filter === "all") matchFilter = true;
    else if (filter === "active") matchFilter = i.status === "approved" && lic.key === "active";
    else matchFilter = lic.key === filter;
    return matchSearch && matchFilter;
  });

  const run = async (inst, fn, msg) => {
    setProcessingId(inst.id);
    try { await fn(); toast({ title: msg }); await load(); }
    catch (e) { toast({ title: "Action failed", description: e.message, variant: "destructive" }); }
    finally { setProcessingId(null); }
  };

  const handleSuspend = (inst) => run(inst, async () => {
    await backend.entities.Institution.update(inst.id, { status: "suspended" });
    await writeAuditLog({ action: "suspend", target_id: inst.id, target_name: inst.name, description: `Suspended "${inst.name}".` });
  }, "Institution suspended");

  const handleReactivate = (inst) => run(inst, async () => {
    await backend.entities.Institution.update(inst.id, { status: "approved" });
    await writeAuditLog({ action: "reactivate", target_id: inst.id, target_name: inst.name, description: `Reactivated "${inst.name}".` });
  }, "Institution reactivated");

  const handleRenew = (inst) => run(inst, async () => {
    const base = inst.subscription_expiry && new Date(inst.subscription_expiry) > new Date() ? inst.subscription_expiry : todayStr();
    const newExpiry = addMonths(base, 12);
    await backend.entities.Institution.update(inst.id, { status: "approved", subscription_expiry: newExpiry });
    await writeAuditLog({ action: "renew", target_id: inst.id, target_name: inst.name, description: `Renewed "${inst.name}" — new expiry ${newExpiry}.` });
  }, "License renewed (12 months)");

  const handleResetAccess = async (inst) => {
    if (!confirm(`Reset access for ${inst.name}? The admin will be locked out until re-approved.`)) return;
    setProcessingId(inst.id);
    try {
      if (inst.admin_user_id) { try { await backend.entities.User.update(inst.admin_user_id, { account_status: "pending" }); } catch (e) { console.warn(e); } }
      await writeAuditLog({ action: "reset_access", target_id: inst.id, target_name: inst.name, description: `Reset admin access for "${inst.name}".` });
      toast({ title: "Access reset", description: inst.name });
      await load();
    } catch (e) { toast({ title: "Reset failed", description: e.message, variant: "destructive" }); }
    finally { setProcessingId(null); }
  };

  const handleReject = async () => {
    if (!rejectInst) return;
    const inst = rejectInst;
    setProcessingId(inst.id);
    try {
      await backend.entities.Institution.update(inst.id, { status: "rejected", admin_reason: rejectReason });
      if (inst.admin_user_id) { try { await backend.entities.User.update(inst.admin_user_id, { account_status: "rejected" }); } catch (e) { console.warn(e); } }
      await writeAuditLog({ action: "reject", target_id: inst.id, target_name: inst.name, description: `Rejected "${inst.name}". Reason: ${rejectReason || "—"}` });
      toast({ title: "Institution rejected" });
      setRejectInst(null); setRejectReason("");
      await load();
    } catch (e) { toast({ title: "Reject failed", description: e.message, variant: "destructive" }); }
    finally { setProcessingId(null); }
  };

  if (denied) {
    return (
      <Layout>
        <div className="luxury-card rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">This area is restricted to the System Owner.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold gold-text">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage institutions, licenses & platform access</p>
          </div>
        </div>
        <Button onClick={() => setRegisterOpen(true)} className="gold-gradient text-black font-semibold">
          <Plus className="w-4 h-4 mr-1" /> Register Institution
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <OwnerStatCards institutions={institutions} users={users} />

          <div className="flex flex-col sm:flex-row gap-3 mt-8 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search institutions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f.key ? "luxury-card border-primary/40" : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"}`}>{f.label}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="luxury-card rounded-2xl p-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No institutions match.</p>
            </div>
          ) : (
            <InstitutionTable
              institutions={filtered} users={users} processingId={processingId}
              onApprove={setApproveInst}
              onReject={(i) => { setRejectInst(i); setRejectReason(""); }}
              onSuspend={handleSuspend} onReactivate={handleReactivate}
              onManage={setManageInst} onView={setViewInst}
              onRenew={handleRenew} onResetAccess={handleResetAccess}
            />
          )}

          <div className="mt-8">
            <AuditLogPanel logs={logs} loading={false} />
          </div>
        </>
      )}

      <RegisterInstitutionDialog open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={load} />
      <ApproveInstitutionDialog open={!!approveInst} inst={approveInst} onOpenChange={(o) => !o && setApproveInst(null)} onDone={load} />
      <ManageInstitutionDialog open={!!manageInst} inst={manageInst} onOpenChange={(o) => !o && setManageInst(null)} onSaved={load} />
      <ViewInstitutionDialog open={!!viewInst} inst={viewInst} onOpenChange={(o) => !o && setViewInst(null)} />

      <Dialog open={!!rejectInst} onOpenChange={(o) => !o && setRejectInst(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectInst?.name}</DialogTitle>
            <DialogDescription>Provide a reason. This will be visible to the institution admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rr">Reason</Label>
            <Input id="rr" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Registration could not be verified" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectInst(null)}>Cancel</Button>
            <Button onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}