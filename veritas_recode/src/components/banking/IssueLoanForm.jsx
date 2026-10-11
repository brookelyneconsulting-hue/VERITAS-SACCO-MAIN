import React, { useState } from "react";
import { backend } from "@/api/backendClient";
import { institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, BadgeDollarSign, CalendarClock } from "lucide-react";
import { useMoney } from "@/lib/useMoney";
import {
  buildAmortizationSchedule,
  monthlyInstallment,
  totalInterest,
} from "@/lib/amortization";
import { LOAN_COLLATERAL_MULTIPLIER, collateralBalance } from "@/lib/loanSource";
import { exportToCSV } from "@/lib/csvExport";
import { Download } from "lucide-react";

const LOAN_TYPES = [
  { value: "normal", label: "Ordinary", rateKey: "rate_normal" },
  { value: "advance", label: "Advance", rateKey: "rate_advance" },
  { value: "emergency", label: "Emergency / Top-up", rateKey: "rate_emergency" },
];

// Issue (disburse) a loan to a member at the counter. The loan is secured by
// Shares (BOSA) or Savings (FOSA) with a 3x collateral cap, uses the
// institution's configured rate for the loan type, and a reducing-balance
// amortization schedule is previewed and generated. The disbursed principal
// counts as cash out on the institutional balance automatically (same
// accounting rule as loans created on the Loans page).
export default function IssueLoanForm({ members, shares = [], accounts = [], bankBalance = null, rates = {}, onIssued }) {
  const { toast } = useToast();
  const { money, symbol } = useMoney();
  const [memberId, setMemberId] = useState("");
  const [loanSource, setLoanSource] = useState("");
  const [loanType, setLoanType] = useState("normal");
  const [principal, setPrincipal] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [loanNumber, setLoanNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const member = members.find((m) => m.id === memberId);
  const rate = LOAN_TYPES.find((t) => t.value === loanType)?.rateKey;
  const interestRate = Number(rates[rate] ?? rates.rate_normal ?? 12) || 0;

  const collateral = loanSource
    ? collateralBalance(loanSource, {
        shares: shares.filter((s) => s.member_id === memberId),
        accounts: accounts.filter((a) => a.member_id === memberId),
      })
    : 0;
  const maxAmount = collateral * LOAN_COLLATERAL_MULTIPLIER;

  const p = parseFloat(principal) || 0;
  const term = Math.max(0, Math.floor(parseFloat(termMonths) || 0));
  const installment = monthlyInstallment(p, interestRate, term);
  const schedule = p > 0 && term > 0
    ? buildAmortizationSchedule({ principal: p, interest_rate: interestRate, term_months: term, start_date: date })
    : [];
  const interestPayable = totalInterest(schedule);

  const changeMember = (id) => { setMemberId(id); setLoanSource(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (!memberId) return toast({ title: "Select a member", variant: "destructive" });
    if (!loanSource) return toast({ title: "Select the loan source (Shares (BOSA) or Savings (FOSA))", variant: "destructive" });
    if (p <= 0) return toast({ title: "Enter a valid principal amount", variant: "destructive" });
    if (term <= 0) return toast({ title: "Enter the term in months", variant: "destructive" });
    if (collateral <= 0) {
      return toast({
        title: `Member has no ${loanSource === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} to secure this loan`,
        variant: "destructive",
      });
    }
    if (p > maxAmount) {
      return toast({
        title: "Principal exceeds the collateral limit",
        description: `${loanSource === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} collateral: ${money(collateral)} — principal capped at ${LOAN_COLLATERAL_MULTIPLIER}× (${money(maxAmount)}).`,
        variant: "destructive",
      });
    }
    if (bankBalance !== null && p > bankBalance) {
      return toast({
        title: "Principal exceeds the institutional bank balance",
        description: `Live institutional balance: ${money(bankBalance)}.`,
        variant: "destructive",
      });
    }
    setSaving(true);
    try {
      const instId = await institutionIdForCreate();
      const num = loanNumber.trim() || `LN-${Date.now().toString().slice(-6)}`;
      const loan = await backend.entities.Loan.create({
        institution_id: instId,
        member_id: memberId,
        member_name: member?.full_name || "",
        loan_number: num,
        principal: p,
        interest_rate: interestRate,
        term_months: term,
        balance: p,
        interest_payable: interestPayable,
        installment_amount: installment,
        payment_due_date: schedule[0]?.due_date || "",
        status: "active",
        disbursement_date: date,
        loan_source: loanSource,
      });
      // Generate the pending repayment schedule from the amortization table.
      await backend.entities.Repayment.bulkCreate(
        schedule.map((row) => ({
          institution_id: instId,
          loan_id: loan.id,
          member_id: memberId,
          member_name: member?.full_name || "",
          loan_number: num,
          installment_number: row.installment,
          amount: row.payment,
          interest_amount: row.interest,
          principal_amount: row.principal,
          balance: row.balance,
          due_date: row.due_date,
          status: "pending",
        }))
      );
      toast({
        title: "Loan issued",
        description: `${money(p)} disbursed to ${member?.full_name || "member"} — loan ${num} at ${interestRate}% (${term} months), secured by ${loanSource === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"}.`,
      });
      setMemberId(""); setLoanSource(""); setPrincipal(""); setTermMonths(""); setLoanNumber("");
      onIssued && onIssued();
    } catch {
      toast({ title: "Could not issue the loan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <BadgeDollarSign className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Issue Loan (Counter Disbursement)</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Disburse a loan over the counter, secured by the member's Shares (BOSA) or Savings (FOSA) — principal capped at {LOAN_COLLATERAL_MULTIPLIER}× collateral. The appropriate institution rate applies and the amortization schedule is generated below.
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
          <Label>Loan Source (Collateral)</Label>
          <Select value={loanSource} onValueChange={setLoanSource} disabled={!memberId}>
            <SelectTrigger>
              <SelectValue placeholder={memberId ? "Select source" : "Select member first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shares">Shares (BOSA)</SelectItem>
              <SelectItem value="savings">Savings (FOSA)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Loan Type</Label>
          <Select value={loanType} onValueChange={setLoanType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOAN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="issue-principal">Principal ({symbol.trim()})</Label>
          <Input
            id="issue-principal"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issue-term">Term (Months)</Label>
          <Input
            id="issue-term"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 12"
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issue-date">Disbursement Date</Label>
          <Input id="issue-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issue-number">Loan Number (optional)</Label>
          <Input
            id="issue-number"
            placeholder="Auto-generated if empty"
            value={loanNumber}
            onChange={(e) => setLoanNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Interest rate: <span className="text-foreground font-medium">{interestRate}%</span> (institution setting)</p>
          {loanSource && (
            <p>{loanSource === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} collateral: <span className="text-foreground font-medium">{money(collateral)}</span> — principal capped at {money(maxAmount)}.</p>
          )}
          {p > 0 && term > 0 && (
            <p>Monthly installment: <span className="text-foreground font-medium">{money(installment)}</span> · Total interest: <span className="text-rose-400 font-medium">{money(interestPayable)}</span> · Total repayable: <span className="text-foreground font-medium">{money(p + interestPayable)}</span></p>
          )}
        </div>
        <Button type="submit" disabled={saving} className="sunset-card-gradient text-slate-950 font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeDollarSign className="w-4 h-4" />}
          Issue Loan
        </Button>
      </div>

      {schedule.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h5 className="text-sm font-semibold text-foreground">Amortization Schedule (reducing balance)</h5>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() =>
                exportToCSV(
                  schedule.map((row) => ({
                    Installment: row.installment,
                    Due_Date: row.due_date,
                    Installment_Amount: row.payment.toFixed(2),
                    Interest: row.interest.toFixed(2),
                    Principal: row.principal.toFixed(2),
                    Balance: row.balance.toFixed(2),
                  })),
                  `amortization-schedule-${member?.full_name?.replace(/\s+/g, "-").toLowerCase() || "member"}.csv`,
                  ["Installment", "Due_Date", "Installment_Amount", "Interest", "Principal", "Balance"]
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              Download Schedule
            </Button>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Due Date</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Installment</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Interest</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Principal</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.installment} className="border-b border-border/40">
                    <td className="px-3 py-2 text-muted-foreground">{row.installment}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground font-medium">{money(row.payment)}</td>
                    <td className="px-3 py-2 text-right text-rose-400">{money(row.interest)}</td>
                    <td className="px-3 py-2 text-right text-emerald-500">{money(row.principal)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{money(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}