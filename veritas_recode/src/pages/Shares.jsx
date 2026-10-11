import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Plus, Search, ArrowRightLeft, HandCoins, Pencil, Trash2 } from "lucide-react";
import { useMoney } from "@/lib/useMoney";
import AutomateContributionsButton from "@/components/shares/AutomateContributionsButton";
import ShareSummariesDialog from "@/components/shares/ShareSummariesDialog";

export default function Shares() {
  const [shares, setShares] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [form, setForm] = useState({
    member_id: "", member_name: "", balance: 0,
    contributions_count: 0, last_contribution_date: "",
  });
  const [transferForm, setTransferForm] = useState({
    from_id: "", from_name: "", to_id: "", to_name: "", amount: 0,
  });
  const [redeemForm, setRedeemForm] = useState({
    member_id: "", member_name: "", amount: 0,
  });

  const load = async () => {
    try {
      const [sharesData, membersData] = await Promise.all([
        backend.entities.Share.list(),
        backend.entities.Member.list(),
      ]);
      setShares(await scoped(sharesData));
      setMembers(await scoped(membersData));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = shares.filter((s) => {
    const matchSearch = s.member_name?.toLowerCase().includes(search.toLowerCase());
    const date = s.last_contribution_date;
    const matchFrom = !fromDate || (date && date >= fromDate);
    const matchTo = !toDate || (date && date <= toDate);
    return matchSearch && matchFrom && matchTo;
  });

  const handleMemberChange = (memberId) => {
    const m = members.find((x) => x.id === memberId);
    setForm({ ...form, member_id: memberId, member_name: m ? m.full_name : "" });
  };

  const handleSubmit = async () => {
    if (editingId) {
      await backend.entities.Share.update(editingId, form);
    } else {
      await backend.entities.Share.create({ ...form, institution_id: await institutionIdForCreate() });
    }
    setOpen(false);
    setEditingId(null);
    setForm({ member_id: "", member_name: "", balance: 0, contributions_count: 0, last_contribution_date: "" });
    load();
  };

  const handleEdit = (share) => {
    setEditingId(share.id);
    setForm({
      member_id: share.member_id || "",
      member_name: share.member_name || "",
      balance: share.balance || 0,
      contributions_count: share.contributions_count || 0,
      last_contribution_date: share.last_contribution_date || "",
    });
    setOpen(true);
  };

  const handleDelete = async (shareId) => {
    if (!confirm("Delete this share record? This cannot be undone.")) return;
    await backend.entities.Share.delete(shareId);
    load();
  };

  const handleTransfer = async () => {
    const amount = Number(transferForm.amount) || 0;
    if (amount <= 0 || !transferForm.from_id || !transferForm.to_id) return;
    const fromShare = shares.find((s) => s.member_id === transferForm.from_id);
    if (!fromShare || (fromShare.balance || 0) < amount) {
      alert("Insufficient share balance for transfer.");
      return;
    }
    const toShare = shares.find((s) => s.member_id === transferForm.to_id);
    const today = new Date().toISOString().slice(0, 10);

    // Deduct from source
    await backend.entities.Share.update(fromShare.id, {
      balance: (fromShare.balance || 0) - amount,
    });
    // Add to destination
    if (toShare) {
      await backend.entities.Share.update(toShare.id, {
        balance: (toShare.balance || 0) + amount,
        contributions_count: (toShare.contributions_count || 0) + 1,
        last_contribution_date: today,
      });
    } else {
      await backend.entities.Share.create({
        institution_id: await institutionIdForCreate(),
        member_id: transferForm.to_id,
        member_name: transferForm.to_name,
        balance: amount,
        contributions_count: 1,
        last_contribution_date: today,
      });
    }
    // Record transaction
    await backend.entities.ShareTransaction.create({
      institution_id: await institutionIdForCreate(),
      type: "transfer",
      from_member_id: transferForm.from_id,
      from_member_name: transferForm.from_name,
      to_member_id: transferForm.to_id,
      to_member_name: transferForm.to_name,
      amount,
      date: today,
      status: "completed",
      reference: "Share transfer",
    });

    setTransferOpen(false);
    setTransferForm({ from_id: "", from_name: "", to_id: "", to_name: "", amount: 0 });
    load();
  };

  const handleRedeem = async () => {
    const amount = Number(redeemForm.amount) || 0;
    if (amount <= 0 || !redeemForm.member_id) return;
    const share = shares.find((s) => s.member_id === redeemForm.member_id);
    if (!share || (share.balance || 0) < amount) {
      alert("Insufficient share balance for redemption.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);

    // Deduct from member's shares (convert to cash)
    await backend.entities.Share.update(share.id, {
      balance: (share.balance || 0) - amount,
    });
    // Record transaction
    await backend.entities.ShareTransaction.create({
      institution_id: await institutionIdForCreate(),
      type: "redemption",
      from_member_id: redeemForm.member_id,
      from_member_name: redeemForm.member_name,
      amount,
      date: today,
      status: "completed",
      reference: "Share redemption (cash payout)",
    });

    setRedeemOpen(false);
    setRedeemForm({ member_id: "", member_name: "", amount: 0 });
    load();
  };

  const { money, symbol } = useMoney();
  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Shares</h1>
          <p className="text-muted-foreground mt-1">
            Monitor member share balances, transfers, and redemptions
          </p>
        </div>
        <div className="flex gap-2">
          <AutomateContributionsButton />
          <ShareSummariesDialog />
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Shares</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>From Member</Label>
                  <Select onValueChange={(v) => {
                    const m = members.find((x) => x.id === v);
                    setTransferForm({ ...transferForm, from_id: v, from_name: m?.full_name || "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select source member" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.member_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>To Member</Label>
                  <Select onValueChange={(v) => {
                    const m = members.find((x) => x.id === v);
                    setTransferForm({ ...transferForm, to_id: v, to_name: m?.full_name || "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select destination member" /></SelectTrigger>
                    <SelectContent>
                      {members.filter((m) => m.id !== transferForm.from_id).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.member_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount ({symbol.trim()})</Label>
                  <Input type="number" value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })} />
                </div>
                <Button onClick={handleTransfer} className="w-full bg-primary hover:bg-primary/90">
                  Transfer Shares
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <HandCoins className="w-4 h-4 mr-2" />
                Redeem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Redeem Shares (Convert to Cash)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Member</Label>
                  <Select onValueChange={(v) => {
                    const m = members.find((x) => x.id === v);
                    setRedeemForm({ ...redeemForm, member_id: v, member_name: m?.full_name || "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.member_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {redeemForm.member_id && (() => {
                  const sh = shares.find((s) => s.member_id === redeemForm.member_id);
                  return sh ? (
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                      Current balance: <span className="font-semibold text-foreground">{money(sh.balance || 0)}</span>
                    </p>
                  ) : null;
                })()}
                <div>
                  <Label>Amount to Redeem ({symbol.trim()})</Label>
                  <Input type="number" value={redeemForm.amount}
                    onChange={(e) => setRedeemForm({ ...redeemForm, amount: Number(e.target.value) })} />
                </div>
                <Button onClick={handleRedeem} className="w-full bg-primary hover:bg-primary/90">
                  Redeem Shares
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Record Share
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Share Record" : "Record Member Share"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Member</Label>
                  <Select onValueChange={handleMemberChange}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.member_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Balance ({symbol.trim()})</Label>
                    <Input type="number" value={form.balance}
                      onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Contributions</Label>
                    <Input type="number" value={form.contributions_count}
                      onChange={(e) => setForm({ ...form, contributions_count: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label>Last Contribution Date</Label>
                  <Input type="date" value={form.last_contribution_date}
                    onChange={(e) => setForm({ ...form, last_contribution_date: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full bg-primary hover:bg-primary/90">
                  {editingId ? "Update Share Record" : "Save Share Record"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{money(totalShares)}</p>
          <p className="text-sm text-muted-foreground">Total Share Capital</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by member..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <DateRangeFilter fromDate={fromDate} toDate={toDate}
          onFromChange={setFromDate} onToChange={setToDate}
          onClear={() => { setFromDate(""); setToDate(""); }} />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No share records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Member</th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3">Balance</th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Contributions</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Last Contribution</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{s.member_name}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-primary">
                      {money(s.balance || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground hidden sm:table-cell">
                      {s.contributions_count || 0}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {s.last_contribution_date ? new Date(s.last_contribution_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-500" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/20 border-t-2 border-border">
                    <td className="px-5 py-3 font-semibold text-foreground">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-primary">
                      {money(filtered.reduce((s, sh) => s + (sh.balance || 0), 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {filtered.reduce((s, sh) => s + (sh.contributions_count || 0), 0)}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell"></td>
                    <td className="px-5 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}