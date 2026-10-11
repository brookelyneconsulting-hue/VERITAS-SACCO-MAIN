import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  CalendarClock, Loader2, CheckCircle2, Search, Plus, Eye, Pause, Play, Trash2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useMoney } from "@/lib/useMoney";
import MemberShareSchedule from "./MemberShareSchedule";

const addMonth = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

export default function AutomateContributionsButton() {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [viewMember, setViewMember] = useState(null);
  const { money } = useMoney();

  const load = async () => {
    const [m, s] = await Promise.all([
      backend.entities.Member.list().then(scoped),
      backend.entities.ShareSchedule.list().then(scoped),
    ]);
    setMembers(m);
    setSchedules(s);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const filteredMembers = members
    .filter((m) =>
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.member_number?.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 8);

  const saveSchedule = async () => {
    if (!selected || !monthlyAmount || !startDate) {
      toast({ title: "Select a member and enter a monthly amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await backend.entities.ShareSchedule.create({
        institution_id: selected.institution_id || (await institutionIdForCreate()),
        member_id: selected.id,
        member_name: selected.full_name,
        monthly_amount: Number(monthlyAmount),
        start_date: startDate,
        next_due_date: startDate,
        status: "active",
      });
      toast({
        title: "Monthly contribution scheduled",
        description: `${selected.full_name} — ${money(Number(monthlyAmount))}/month.`,
      });
      setSelected(null);
      setSearch("");
      setMonthlyAmount(0);
      load();
    } catch {
      toast({ title: "Could not save schedule", variant: "destructive" });
    }
    setSaving(false);
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const instId = await institutionIdForCreate();
      const [memberPayments, shareTxns, schedList, shareList] = await Promise.all([
        backend.entities.MemberPayment.list(),
        backend.entities.ShareTransaction.list(),
        backend.entities.ShareSchedule.list(),
        backend.entities.Share.list(),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const appliedRefs = new Set(shareTxns.map((t) => t.reference).filter(Boolean));

      let scheduleApplied = 0, scheduleAmount = 0;
      for (const sch of schedList.filter((s) => s.status === "active" && s.next_due_date && s.next_due_date <= today)) {
        const ym = sch.next_due_date.slice(0, 7).replace("-", "");
        const ref = `SCH-${ym}-${sch.id}`;
        if (appliedRefs.has(ref)) {
          await backend.entities.ShareSchedule.update(sch.id, { next_due_date: addMonth(sch.next_due_date) }).catch(() => {});
          continue;
        }
        const share = shareList.find((s) => s.member_id === sch.member_id);
        try {
          if (share) {
            await backend.entities.Share.update(share.id, {
              balance: (share.balance || 0) + (sch.monthly_amount || 0),
              contributions_count: (share.contributions_count || 0) + 1,
              last_contribution_date: sch.next_due_date,
            });
          } else {
            await backend.entities.Share.create({
              institution_id: sch.institution_id || instId,
              member_id: sch.member_id,
              member_name: sch.member_name,
              balance: sch.monthly_amount || 0,
              contributions_count: 1,
              last_contribution_date: sch.next_due_date,
            });
          }
          await backend.entities.ShareTransaction.create({
            institution_id: sch.institution_id || instId,
            type: "contribution",
            from_member_id: sch.member_id,
            from_member_name: sch.member_name,
            amount: sch.monthly_amount || 0,
            date: sch.next_due_date,
            status: "completed",
            reference: ref,
          });
          await backend.entities.ShareSchedule.update(sch.id, {
            next_due_date: addMonth(sch.next_due_date),
            last_applied_date: sch.next_due_date,
          });
          scheduleApplied++;
          scheduleAmount += sch.monthly_amount || 0;
        } catch {}
      }

      // Also apply approved share payments not yet applied (existing behaviour)
      const approved = memberPayments.filter((p) => p.payment_type === "shares" && p.status === "approved");
      let payApplied = 0, payAmount = 0;
      for (const p of approved) {
        const ref = `AUTO-CONTRIB-${p.id}`;
        if (appliedRefs.has(ref)) continue;
        const share = shareList.find((s) => s.member_id === p.member_id);
        try {
          if (share) {
            await backend.entities.Share.update(share.id, {
              balance: (share.balance || 0) + (p.amount || 0),
              contributions_count: (share.contributions_count || 0) + 1,
              last_contribution_date: p.payment_date,
            });
          } else {
            await backend.entities.Share.create({
              institution_id: p.institution_id || instId,
              member_id: p.member_id,
              member_name: p.member_name,
              balance: p.amount || 0,
              contributions_count: 1,
              last_contribution_date: p.payment_date,
            });
          }
          await backend.entities.ShareTransaction.create({
            institution_id: p.institution_id || instId,
            type: "contribution",
            from_member_id: p.member_id,
            from_member_name: p.member_name,
            amount: p.amount || 0,
            date: p.payment_date,
            status: "completed",
            reference: ref,
          });
          payApplied++;
          payAmount += p.amount || 0;
        } catch {}
      }

      setResult({ scheduleApplied, scheduleAmount, payApplied, payAmount });
      toast({
        title: "Automation complete",
        description: `${scheduleApplied} scheduled + ${payApplied} payment contributions applied.`,
      });
      load();
    } catch {
      toast({ title: "Automation failed", variant: "destructive" });
    }
    setRunning(false);
  };

  const togglePause = async (sch) => {
    await backend.entities.ShareSchedule.update(sch.id, {
      status: sch.status === "active" ? "paused" : "active",
    });
    load();
  };

  const remove = async (sch) => {
    if (!confirm("Delete this contribution schedule?")) return;
    await backend.entities.ShareSchedule.delete(sch.id);
    load();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-amber-900 hover:bg-amber-950 text-amber-50">
        <CalendarClock className="w-4 h-4 mr-2" /> Automate Contributions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Automate Monthly Share Contributions</DialogTitle>
            <DialogDescription>
              Schedule a monthly contribution per member, run automation to apply due amounts, and view printable share schedules.
            </DialogDescription>
          </DialogHeader>

          {/* Setup form */}
          <div className="rounded-xl border border-border p-4">
            <h4 className="font-semibold text-foreground mb-3">Set up Monthly Contribution</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Search &amp; Select Member</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or number..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                    className="pl-9"
                  />
                </div>
                {search && !selected && (
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-card">
                    {filteredMembers.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">No members found</p>
                    ) : (
                      filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelected(m); setSearch(m.full_name); }}
                          className="w-full text-left px-3 py-2 hover:bg-muted/30 text-sm"
                        >
                          {m.full_name} <span className="text-muted-foreground">({m.member_number})</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selected && (
                  <p className="mt-1 text-xs text-emerald-500">Selected: {selected.full_name} ({selected.member_number})</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monthly Amount</Label>
                  <Input type="number" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
            </div>
            <Button onClick={saveSchedule} disabled={saving} className="mt-3 w-full bg-amber-900 hover:bg-amber-950 text-amber-50">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Save Schedule
            </Button>
          </div>

          {/* Run */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <h4 className="font-semibold text-foreground">Run Automation</h4>
              <p className="text-xs text-muted-foreground">
                Applies due monthly schedules and approved share payments to share balances. Safe to run anytime — already-applied entries are skipped.
              </p>
            </div>
            <Button onClick={run} disabled={running} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />} Run Now
            </Button>
          </div>
          {result && (
            <div className="flex items-center gap-2 rounded-xl p-3 text-sm font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {result.scheduleApplied} scheduled ({money(result.scheduleAmount)}) + {result.payApplied} payment ({money(result.payAmount)}) contributions applied.
            </div>
          )}

          {/* Schedules list */}
          <div>
            <h4 className="font-semibold text-foreground mb-2">Contribution Schedules</h4>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">No schedules yet. Set one up above.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Member</th>
                      <th className="text-right font-medium text-muted-foreground px-3 py-2">Monthly</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Next Due</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s) => (
                      <tr key={s.id} className="border-b border-border/30">
                        <td className="px-3 py-2 font-medium text-foreground">{s.member_name}</td>
                        <td className="px-3 py-2 text-right text-foreground">{money(s.monthly_amount || 0)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.next_due_date ? new Date(s.next_due_date).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={s.status === "active" ? "text-emerald-500" : "text-amber-500"}>{s.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewMember({ id: s.member_id, name: s.member_name })} title="View printable schedule">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => togglePause(s)} title={s.status === "active" ? "Pause" : "Resume"}>
                              {s.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500" onClick={() => remove(s)} title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {viewMember && (
        <MemberShareSchedule memberId={viewMember.id} memberName={viewMember.name} onClose={() => setViewMember(null)} />
      )}
    </>
  );
}