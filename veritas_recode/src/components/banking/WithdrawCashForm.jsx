import React, { useState } from "react";
import { backend } from "@/api/backendClient";
import { institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, HandCoins, BadgeCheck } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

// Issue physical cash to a member at the counter (withdrawal). The amount is
// deducted from the member's FOSA/BOSA account and recorded as cash out on the
// live institutional bank balance. The teller must confirm the member's ID
// before the withdrawal can be submitted.
export default function WithdrawCashForm({ members, accounts = [], bankBalance = null, withdrawalFee = 0, onWithdrawn }) {
  const { toast } = useToast();
  const { money } = useMoney();
  const fee = Math.max(0, Number(withdrawalFee) || 0);
  const [memberId, setMemberId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [idVerified, setIdVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const member = members.find((m) => m.id === memberId);
  const memberAccounts = memberId
    ? accounts.filter((a) => a.member_id === memberId && a.status !== "frozen")
    : [];
  const selectedAccount = memberAccounts.find((a) => a.id === accountId) || memberAccounts[0] || null;

  const changeMember = (id) => { setMemberId(id); setAccountId(""); };

  const reset = () => { setAmount(""); setReference(""); setIdVerified(false); };

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!memberId) return toast({ title: "Select a member", variant: "destructive" });
    if (!selectedAccount) {
      return toast({
        title: "This member has no BOSA or FOSA account yet",
        description: "Open one under Member Accounts below first.",
        variant: "destructive",
      });
    }
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    if (amt + fee > (selectedAccount.balance || 0)) {
      return toast({
        title: "Amount plus transaction fee exceeds the account balance",
        description: `${money(amt + fee)} requested (incl. ${money(fee)} fee) — ${selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} balance: ${money(selectedAccount.balance || 0)}.`,
        variant: "destructive",
      });
    }
    if (bankBalance !== null && amt > bankBalance) {
      return toast({
        title: "Amount exceeds the institutional bank balance",
        description: `Live institutional balance: ${money(bankBalance)}.`,
        variant: "destructive",
      });
    }
    if (!idVerified) {
      return toast({
        title: "Confirm the member's ID",
        description: "Tick the ID verification box after checking the member's original ID document.",
        variant: "destructive",
      });
    }
    setSaving(true);
    try {
      const instId = await institutionIdForCreate();
      const ref = reference.trim() || `WD-${Date.now().toString().slice(-8)}`;
      // Cash out on the institutional balance + a record of the counter payout.
      await backend.entities.BankWithdrawal.create({
        institution_id: instId,
        withdrawal_date: date,
        amount: amt,
        member_id: memberId,
        member_name: member?.full_name || "",
        member_number: member?.member_number || "",
        account_id: selectedAccount.id,
        account_type: selectedAccount.account_type,
        account_number: selectedAccount.account_number || "",
        reference: ref,
        description: `Counter withdrawal — ${selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} account`,
        fee,
        id_verified: true,
      });
      await backend.entities.MemberAccount.update(selectedAccount.id, {
        balance: Math.max(0, (selectedAccount.balance || 0) - amt - fee),
      });
      toast({
        title: "Cash issued",
        description: `${money(amt)} paid out to ${member?.full_name || "member"} from their ${selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} account${fee > 0 ? ` — transaction fee ${money(fee)} charged` : ""}.`,
      });
      reset();
      onWithdrawn && onWithdrawn();
    } catch {
      toast({ title: "Could not record the withdrawal", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <HandCoins className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Withdraw Cash (Counter Payout)</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
      Issue money to a member over the counter — deducted from their FOSA (savings) / BOSA account and from the institutional balance instantly.
      {fee > 0 ? ` A transaction fee of ${money(fee)} is charged to the member's account on every withdrawal.` : ""}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Member</Label>
          <Select value={memberId} onValueChange={changeMember}>
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
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
          <Label>Withdraw From</Label>
          {memberId && memberAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-2">
              No BOSA or FOSA account opened for this member yet — open one below.
            </p>
          ) : (
            <Select value={selectedAccount?.id || ""} onValueChange={setAccountId} disabled={!memberId}>
              <SelectTrigger>
                <SelectValue placeholder={memberId ? "Select account" : "Select member first"} />
              </SelectTrigger>
              <SelectContent>
                {memberAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_type === "bosa" ? "BOSA" : "FOSA"} · {a.account_number || "Account"} · {money(a.balance || 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="withdraw-amount">Amount</Label>
          <Input
            id="withdraw-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="withdraw-date">Date Issued</Label>
          <Input id="withdraw-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="withdraw-reference">Receipt / Reference (optional)</Label>
          <Input
            id="withdraw-reference"
            placeholder="Auto-generated if empty"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="id-verified"
            checked={idVerified}
            onCheckedChange={(v) => setIdVerified(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="id-verified" className="flex items-center gap-1.5 font-normal text-sm cursor-pointer">
            <BadgeCheck className="w-4 h-4 text-primary inline sm:hidden" />
            I have verified the member's original ID
            {member?.id_number ? ` (ID No. ${member.id_number})` : ""}
          </Label>
        </div>
        <Button type="submit" disabled={saving} variant="destructive" className="font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
          Withdraw Cash
        </Button>
        {selectedAccount && (
          <p className="text-xs text-muted-foreground">
            {selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} balance: {money(selectedAccount.balance || 0)} — this payout reduces the account and institutional balances{fee > 0 ? `, plus a ${money(fee)} transaction fee on the account` : ""}.
          </p>
        )}
      </div>
    </form>
  );
}