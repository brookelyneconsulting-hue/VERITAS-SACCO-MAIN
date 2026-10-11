import React, { useState } from "react";
import { backend } from "@/api/backendClient";
import { institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Banknote, Coins } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

// Receive physical cash for a loan repayment or a share contribution.
// The receipt is recorded as an APPROVED payment so it counts as cash in
// on the live institutional bank balance immediately, and the loan/share
// balances are applied at the same time (same rules as Payments approval).
export default function ReceiveCashForm({ members, loans, shares, accounts = [], onReceived }) {
  const { toast } = useToast();
  const { money } = useMoney();
  const [type, setType] = useState("loan");
  const [specify, setSpecify] = useState("");
  const [memberId, setMemberId] = useState("");
  const [loanId, setLoanId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const member = members.find((m) => m.id === memberId);
  const memberLoans = memberId
    ? loans.filter((l) => l.member_id === memberId && l.status === "active" && (l.balance || 0) > 0)
    : [];
  const selectedLoan = memberLoans.find((l) => l.id === loanId) || memberLoans[0] || null;
  const memberAccounts = memberId
    ? accounts.filter((a) => a.member_id === memberId && a.status !== "frozen")
    : [];
  const selectedAccount = memberAccounts.find((a) => a.id === accountId) || memberAccounts[0] || null;

  const changeType = (t) => { setType(t); setLoanId(""); setAccountId(""); };
  const changeMember = (id) => { setMemberId(id); setLoanId(""); setAccountId(""); };

  const reset = () => { setAmount(""); setReference(""); setSpecify(""); };

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if ((type === "loan" || type === "shares" || type === "account") && !memberId) {
      return toast({ title: "Select a member", variant: "destructive" });
    }
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    const ref = reference.trim() || `CASH-${Date.now().toString().slice(-8)}`;
    setSaving(true);
    try {
      const instId = await institutionIdForCreate();

      if (type === "others") {
        const spec = specify.trim();
        if (!spec) {
          toast({ title: "Specify what the cash is for", variant: "destructive" });
          return;
        }
        // Standalone cash receipt (no linked member payment) — recorded as a
        // direct bank deposit so it counts as cash in on the institutional balance.
        await backend.entities.BankDeposit.create({
          institution_id: instId,
          deposit_date: date,
          amount: amt,
          source_type: "other",
          reference: ref,
          description: spec,
          member_name: member?.full_name || "",
        });
        toast({ title: "Cash received", description: `${money(amt)} — ${spec}.` });
        reset();
        onReceived && onReceived();
        return;
      }

      if (type === "account") {
        if (!selectedAccount) {
          toast({
            title: "This member has no BOSA or FOSA account yet",
            description: "Open one under Member Accounts below first.",
            variant: "destructive",
          });
          return;
        }
        // Account deposit — recorded as a direct bank deposit (cash in on the
        // institutional balance) and credited to the member's account.
        await backend.entities.BankDeposit.create({
          institution_id: instId,
          deposit_date: date,
          amount: amt,
          source_type: "other",
          reference: ref,
          description: `${selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} deposit — ${selectedAccount.account_number || ""}`,
          member_name: member?.full_name || "",
        });
        await backend.entities.MemberAccount.update(selectedAccount.id, {
          balance: (selectedAccount.balance || 0) + amt,
        });
        toast({
          title: "Cash received",
          description: `${money(amt)} deposited into ${selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} account ${selectedAccount.account_number || ""}.`,
        });
      } else if (type === "loan") {
        if (!selectedLoan) {
          toast({ title: "This member has no active loan with an outstanding balance", variant: "destructive" });
          return;
        }
        if (amt > (selectedLoan.balance || 0)) {
          toast({ title: "Amount exceeds the loan's outstanding balance", variant: "destructive" });
          return;
        }
        await backend.entities.LoanPayment.create({
          institution_id: instId,
          member_id: memberId,
          member_name: member?.full_name || "",
          member_number: member?.member_number || "",
          loan_id: selectedLoan.id,
          loan_number: selectedLoan.loan_number || "",
          amount: amt,
          payment_ref: ref,
          payment_date: date,
          status: "approved",
        });
        // Apply to the earliest pending installment, like payment approval does
        const pending = await backend.entities.Repayment.filter({
          loan_id: selectedLoan.id, status: "pending",
        }).catch(() => []);
        pending.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
        if (pending[0]) {
          await backend.entities.Repayment.update(pending[0].id, {
            status: "paid", payment_date: date,
          }).catch(() => {});
        }
        const newBalance = Math.max(0, (selectedLoan.balance || 0) - amt);
        const updates = { balance: newBalance };
        if (newBalance <= 0) updates.status = "paid";
        await backend.entities.Loan.update(selectedLoan.id, updates);
        toast({
          title: "Cash received",
          description: `${money(amt)} recorded against loan ${selectedLoan.loan_number || ""}. Balance updated.`,
        });
      } else {
        await backend.entities.MemberPayment.create({
          institution_id: instId,
          member_id: memberId,
          member_name: member?.full_name || "",
          member_number: member?.member_number || "",
          payment_type: "shares",
          amount: amt,
          payment_ref: ref,
          payment_date: date,
          status: "approved",
        });
        const existing = shares.find((s) => s.member_id === memberId);
        if (existing) {
          await backend.entities.Share.update(existing.id, {
            balance: (existing.balance || 0) + amt,
            contributions_count: (existing.contributions_count || 0) + 1,
            last_contribution_date: date,
          });
        } else {
          await backend.entities.Share.create({
            institution_id: instId,
            member_id: memberId,
            member_name: member?.full_name || "",
            balance: amt,
            contributions_count: 1,
            last_contribution_date: date,
          });
        }
        // Record the contribution in the share transaction history
        // (Shares page + member profile), same as automated contributions.
        await backend.entities.ShareTransaction.create({
          institution_id: instId,
          type: "contribution",
          from_member_id: memberId,
          from_member_name: member?.full_name || "",
          amount: amt,
          date,
          status: "completed",
          reference: ref,
        });
        toast({
          title: "Cash received",
          description: `${money(amt)} added to ${member?.full_name || "member"}'s shares.`,
        });
      }
      reset();
      onReceived && onReceived();
    } catch {
      toast({ title: "Could not record the cash receipt", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Banknote className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Receive Cash</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Record physical cash received for a loan repayment, share contribution, or FOSA / BOSA account deposit. Cash in updates the institutional balance instantly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Received for</Label>
          <Select value={type} onValueChange={changeType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
            <SelectItem value="loan">Loan Repayment</SelectItem>
            <SelectItem value="shares">Share Contribution</SelectItem>
            <SelectItem value="account">FOSA / BOSA Account Deposit</SelectItem>
            <SelectItem value="others">Others</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Member</Label>
          <Select value={memberId} onValueChange={changeMember}>
            <SelectTrigger>
              <SelectValue placeholder={type === "others" ? "Optional for others" : "Select member"} />
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
        {type === "account" && (
          <div className="space-y-2">
            <Label>Member Account</Label>
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
        )}
        {type === "loan" && (
          <div className="space-y-2">
            <Label>Loan</Label>
            {memberId && memberLoans.length === 0 ? (
              <p className="text-xs text-muted-foreground pt-2">No active loan with an outstanding balance.</p>
            ) : (
              <Select value={selectedLoan?.id || ""} onValueChange={setLoanId} disabled={!memberId}>
                <SelectTrigger>
                  <SelectValue placeholder={memberId ? "Select loan" : "Select member first"} />
                </SelectTrigger>
                <SelectContent>
                  {memberLoans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.loan_number || "Loan"} · {money(l.balance || 0)} outstanding
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date Received</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">Receipt / Reference (optional)</Label>
          <Input
            id="reference"
            placeholder="Auto-generated if empty"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        {type === "others" && (
          <div className="space-y-2">
            <Label htmlFor="specify">Specify (what is it for)</Label>
            <Input
              id="specify"
              placeholder="e.g. Office rent, Grant, Fine"
              value={specify}
              onChange={(e) => setSpecify(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={saving} className="sunset-card-gradient text-slate-950 font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
          Receive Cash
        </Button>
        {type === "loan" && selectedLoan && (
          <p className="text-xs text-muted-foreground">
            Outstanding: {money(selectedLoan.balance || 0)} — this receipt reduces the loan balance.
          </p>
        )}
        {type === "shares" && (
          <p className="text-xs text-muted-foreground">
            Adds to the member's share balance.
          </p>
        )}
        {type === "account" && selectedAccount && (
          <p className="text-xs text-muted-foreground">
            {selectedAccount.account_type === "bosa" ? "BOSA" : "FOSA"} balance: {money(selectedAccount.balance || 0)} — this receipt increases the account balance.
          </p>
        )}
      </div>
    </form>
  );
}