import React, { useEffect, useState, useMemo, useCallback } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Coins, TrendingUp, Divide, Landmark, Loader2, HandCoins, AlertCircle } from "lucide-react";
import { useMoney } from "@/lib/useMoney";
import { computeNetProfit } from "@/lib/netProfit";
import { withLinkedBankBalance, fetchInstitutionBankBalance } from "@/lib/institutionBalance";
import { fetchBalancesVisible, MASKED_BALANCE } from "@/lib/bankBalanceVisibility";
import AllocationPreviewTable from "@/components/dividends/AllocationPreviewTable";
import DeclarationHistory from "@/components/dividends/DeclarationHistory";
import PayoutHistoryTable from "@/components/dividends/PayoutHistoryTable";

export default function Dividends() {
  const { toast } = useToast();
  const { money } = useMoney();
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loans, setLoans] = useState([]);
  const [journal, setJournal] = useState([]);
  const [coa, setCoa] = useState([]);
  const [shares, setShares] = useState([]);
  const [members, setMembers] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [bankBalance, setBankBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [amountToShare, setAmountToShare] = useState("");
  const [amountEdited, setAmountEdited] = useState(false);
  const [distributing, setDistributing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, je, c, s, mem, decl, bal, vis] = await Promise.all([
        backend.entities.Loan.list().then(scoped).catch(() => []),
        backend.entities.JournalEntry.list("-date").catch(() => []),
        backend.entities.ChartOfAccount.list().then(withLinkedBankBalance).catch(() => []),
        backend.entities.Share.list().then(scoped).catch(() => []),
        backend.entities.Member.list().then(scoped).catch(() => []),
        backend.entities.DividendDeclaration.list("-payment_date").then(scoped).catch(() => []),
        fetchInstitutionBankBalance().catch(() => null),
        fetchBalancesVisible(),
      ]);
      setLoans(l);
      setJournal(je);
      setCoa(c);
      setShares(s);
      setMembers(mem);
      setDeclarations(decl);
      setBankBalance(bal ? bal.bankBalance : null);
      setShowBalance(vis);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { netProfit, totalIncome, totalExpenses } = useMemo(
    () => computeNetProfit({ loans, journalEntries: journal, chartOfAccounts: coa, fromDate, toDate }),
    [loans, journal, coa, fromDate, toDate]
  );

  // Pre-fill the amount with the period's net profit until the admin edits it.
  useEffect(() => {
    if (!amountEdited) setAmountToShare(netProfit > 0 ? String(Math.round(netProfit)) : "");
  }, [netProfit, amountEdited]);

  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);
  const amount = Math.max(0, parseFloat(amountToShare) || 0);
  const perShare = totalShares > 0 ? amount / totalShares : 0;
  const memberNumber = (id) => members.find((m) => m.id === id)?.member_number || "";
  const allocations = shares
    .filter((sh) => (sh.balance || 0) > 0)
    .map((sh) => ({
      member_id: sh.member_id,
      member_name: sh.member_name,
      member_number: memberNumber(sh.member_id),
      share_balance: sh.balance,
      dividend_amount: Math.round(((sh.balance / totalShares) * amount) * 100) / 100,
    }));

  const handleDistribute = async () => {
    if (netProfit <= 0) {
      toast({
        title: "No dividends can be shared",
        description: "The net profit for this period is zero or negative — dividends can only be shared out of a positive net profit.",
        variant: "destructive",
      });
      return;
    }
    if (amount <= 0) {
      toast({ title: "Enter the net profit amount to share", variant: "destructive" });
      return;
    }
    if (totalShares <= 0 || allocations.length === 0) {
      toast({ title: "No member shares to allocate against", variant: "destructive" });
      return;
    }
    setDistributing(true);
    try {
      const instId = await institutionIdForCreate();
      const paymentDate = new Date().toISOString().slice(0, 10);
      const decl = await backend.entities.DividendDeclaration.create({
        institution_id: instId,
        period_start: fromDate || "",
        period_end: toDate || paymentDate,
        net_profit: Math.round(netProfit * 100) / 100,
        amount_to_share: amount,
        total_shares: totalShares,
        dividend_per_share: perShare,
        payment_date: paymentDate,
        members_paid: allocations.length,
      });
      await backend.entities.DividendPayment.bulkCreate(
        allocations.map((a) => ({
          institution_id: instId,
          declaration_id: decl.id,
          member_id: a.member_id,
          member_name: a.member_name,
          member_number: a.member_number,
          share_balance: a.share_balance,
          dividend_per_share: perShare,
          dividend_amount: a.dividend_amount,
          payment_date: paymentDate,
        }))
      );
      setAmountEdited(false);
      toast({
        title: "Dividends distributed",
        description: `${money(amount)} shared across ${allocations.length} ${allocations.length === 1 ? "member" : "members"} at ${money(perShare, 4)} per share.`,
      });
      await load();
    } catch {
      toast({ title: "Failed to distribute dividends", variant: "destructive" });
    } finally {
      setDistributing(false);
    }
  };

  const handleDeleteDeclaration = async (d) => {
    if (!window.confirm("Delete this dividend distribution? Members' dividend records will be removed and the bank balance restored.")) return;
    try {
      await backend.entities.DividendPayment.deleteMany({ declaration_id: d.id });
      await backend.entities.DividendDeclaration.delete(d.id);
      toast({ title: "Dividend distribution deleted" });
      await load();
    } catch {
      toast({ title: "Failed to delete distribution", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-10 text-center text-muted-foreground">Loading dividends...</div>
      </Layout>
    );
  }

  const cards = [
    {
      icon: TrendingUp,
      label: "Net Profit (Period)",
      value: money(netProfit),
      color: netProfit >= 0 ? "text-emerald-500" : "text-rose-500",
      sub: `Income ${money(totalIncome)} · Expenses ${money(totalExpenses)}`,
    },
    {
      icon: Coins,
      label: "Total Shares",
      value: money(totalShares),
      color: "text-amber-500",
      sub: `${allocations.length} ${allocations.length === 1 ? "member holds shares" : "members hold shares"}`,
    },
    {
      icon: Divide,
      label: "Dividend per Share",
      value: money(perShare, 4),
      color: "text-primary",
      sub: amount > 0 ? `On ${money(amount)} to be shared` : "Enter an amount to share",
    },
    {
      icon: Landmark,
      label: "Bank Balance (Live)",
      value: bankBalance === null ? "—" : showBalance ? money(bankBalance) : MASKED_BALANCE,
      color: "text-sky-500",
      sub: "Dividend payouts are deducted automatically",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <HandCoins className="w-6 h-6 text-primary" /> Dividends
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Net profit from the Income Statement (Accounting module) shared across members by share holding.
            </p>
          </div>
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onClear={() => { setFromDate(""); setToDate(""); }}
          />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="luxury-card rounded-2xl p-5">
                <Icon className={`w-5 h-5 ${card.color} mb-3`} />
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-sm font-medium text-foreground">{card.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Distribution form */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h4 className="font-semibold text-foreground mb-1">Declare Dividend Payout</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Set the net profits to be shared. It defaults to the period's net profit — adjust as needed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="amount">Net profits to share</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amountToShare}
                  disabled={netProfit <= 0}
                  onChange={(e) => { setAmountEdited(true); setAmountToShare(e.target.value); }}
                />
                <Button
                  variant="outline"
                  onClick={() => setAmountEdited(false)}
                  disabled={netProfit <= 0}
                >
                  Use Net Profit
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleDistribute}
                disabled={distributing || netProfit <= 0 || amount <= 0 || allocations.length === 0}
                className="sunset-card-gradient text-slate-950 font-semibold"
              >
                {distributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
                Distribute Dividends
              </Button>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                Members instantly see their dividend, and the payout reduces the institution's bank balance.
              </p>
            </div>
          </div>
          {netProfit <= 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-500">
              <AlertCircle className="w-3.5 h-3.5" />
              Net profit for this period is {netProfit < 0 ? "negative" : "zero"} — no dividends can be shared.
            </p>
          )}
        </div>

        {/* Allocation preview */}
        {amount > 0 && <AllocationPreviewTable allocations={allocations} perShare={perShare} />}

        {/* History */}
        <DeclarationHistory declarations={declarations} onDelete={handleDeleteDeclaration} />
        <PayoutHistoryTable reloadKey={declarations.map((d) => d.id).join("|")} />
      </div>
    </Layout>
  );
}