import React, { useState } from "react";
import { backend } from "@/api/backendClient";
import { institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Landmark, Plus, Loader2 } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

// FOSA (Front Office — savings) and BOSA (Back Office — long-term) member
// accounts. The admin opens each account here, linked to a member; cash
// received in Banking can be deposited straight into an account.
export default function MemberAccountsPanel({ members, accounts, onChanged }) {
  const { toast } = useToast();
  const { money } = useMoney();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState("fosa");
  const [saving, setSaving] = useState(false);

  const visible = filter === "all" ? accounts : accounts.filter((a) => a.account_type === filter);
  const bosaTotal = accounts.filter((a) => a.account_type === "bosa").reduce((s, a) => s + (a.balance || 0), 0);
  const fosaTotal = accounts.filter((a) => a.account_type === "fosa").reduce((s, a) => s + (a.balance || 0), 0);

  const openAccount = async () => {
    if (!memberId) return toast({ title: "Select a member", variant: "destructive" });
    const member = members.find((m) => m.id === memberId);
    setSaving(true);
    try {
      const instId = await institutionIdForCreate();
      const count = accounts.filter((a) => a.account_type === type).length;
      await backend.entities.MemberAccount.create({
        institution_id: instId,
        member_id: memberId,
        member_name: member?.full_name || "",
        member_number: member?.member_number || "",
        account_type: type,
        account_number: `${type.toUpperCase()}-${String(count + 1).padStart(4, "0")}`,
        balance: 0,
        opened_date: new Date().toISOString().slice(0, 10),
      });
      toast({
        title: "Account opened",
        description: `${type === "bosa" ? "BOSA" : "FOSA"} account linked to ${member?.full_name || "member"}.`,
      });
      setOpen(false);
      setMemberId("");
      onChanged && onChanged();
    } catch {
      toast({ title: "Could not open the account", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filters = [
    { key: "all", label: `All (${accounts.length})` },
    { key: "fosa", label: `FOSA (${accounts.filter((a) => a.account_type === "fosa").length})` },
    { key: "bosa", label: `BOSA (${accounts.filter((a) => a.account_type === "bosa").length})` },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" /> Member Accounts (BOSA &amp; FOSA)
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            FOSA (savings) and BOSA (long-term) accounts, each linked to a member. Receive cash straight into them above.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="sunset-card-gradient text-slate-950 font-semibold">
          <Plus className="w-4 h-4" /> Open Account
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-amber-400 text-black shadow"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          FOSA total <span className="font-semibold text-foreground">{money(fosaTotal)}</span> · BOSA total{" "}
          <span className="font-semibold text-foreground">{money(bosaTotal)}</span>
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No member accounts yet — open a FOSA or BOSA account for a member.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Member</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Account Number</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Type</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Opened</th>
                <th className="text-right font-medium text-muted-foreground px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} className="border-b border-border/30">
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{a.member_name || "—"}</span>
                    {a.member_number && <span className="ml-1 text-xs text-muted-foreground">#{a.member_number}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.account_number || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      a.account_type === "bosa" ? "bg-sky-950/60 text-sky-400" : "bg-amber-950/60 text-amber-500"
                    }`}>
                      {a.account_type === "bosa" ? "BOSA" : "FOSA"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {a.opened_date ? new Date(a.opened_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{money(a.balance || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open Member Account</DialogTitle>
            <DialogDescription>
              Link a FOSA (front office savings) or BOSA (back office, long-term) account to a member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}{m.member_number ? ` · #${m.member_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fosa">FOSA — Front Office Savings</SelectItem>
                  <SelectItem value="bosa">BOSA — Back Office (Long-term)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={openAccount} disabled={saving} className="sunset-card-gradient text-slate-950 font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Open Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}