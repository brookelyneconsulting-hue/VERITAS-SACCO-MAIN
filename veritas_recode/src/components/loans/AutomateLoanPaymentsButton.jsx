import React, { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { CalendarClock, Loader2, CheckCircle2, Banknote } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { processDueDeductions } from "@/lib/autoDeduction";
import { useMoney } from "@/lib/useMoney";

// Manual trigger for the loan auto-deduction engine (principal + interest).
// Same idempotent logic the Dashboard runs automatically in "auto" deposit mode.
export default function AutomateLoanPaymentsButton() {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState([]);
  const [loadingDue, setLoadingDue] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const { money } = useMoney();

  const loadDue = async () => {
    setLoadingDue(true);
    try {
      const repayments = await backend.entities.Repayment.list("-due_date");
      const today = new Date().toISOString().slice(0, 10);
      setDue(
        repayments.filter(
          (r) => r.status === "pending" && r.due_date && r.due_date <= today
        )
      );
    } catch {
      setDue([]);
    }
    setLoadingDue(false);
  };

  useEffect(() => {
    if (open) {
      setResult(null);
      loadDue();
    }
  }, [open]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const [repayments, loanPayments] = await Promise.all([
        backend.entities.Repayment.list("-due_date"),
        backend.entities.LoanPayment.list("-payment_date"),
      ]);
      const created = await processDueDeductions(backend, { repayments, loanPayments });
      const total = created.reduce((s, r) => s + (r.amount || 0), 0);
      setResult({ count: created.length, total });
      toast({
        title: "Loan payment automation complete",
        description:
          created.length > 0
            ? `${created.length} installment(s) deducted — principal + interest applied to balances and bank.`
            : "No new due installments to deduct.",
      });
      loadDue();
    } catch {
      toast({ title: "Automation failed", variant: "destructive" });
    }
    setRunning(false);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-amber-900 hover:bg-amber-950 text-amber-50"
        title="Deduct due principal + interest installments"
      >
        <CalendarClock className="w-4 h-4 mr-2" /> Automate Payments
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Automate Loan Payments (Principal + Interest)</DialogTitle>
            <DialogDescription>
              Deducts every due installment: creates an approved loan payment (feeding the bank
              balance), marks the installment paid, and reduces the loan's outstanding balance.
              Safe to run anytime — already-deducted installments are skipped.
            </DialogDescription>
          </DialogHeader>

          {/* Run */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <h4 className="font-semibold text-foreground">Run Automation</h4>
              <p className="text-xs text-muted-foreground">
                {loadingDue ? "Checking due installments…" : `${due.length} installment(s) due for deduction.`}
              </p>
            </div>
            <Button onClick={run} disabled={running || loadingDue} className="bg-amber-900 hover:bg-amber-950 text-amber-50 shrink-0">
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />} Run Now
            </Button>
          </div>

          {result && (
            <div className="flex items-center gap-2 rounded-xl p-3 text-sm font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {result.count > 0
                ? `${result.count} installment(s) deducted — ${money(result.total)} (principal + interest) applied.`
                : "Nothing to deduct — all due installments are already paid."}
            </div>
          )}

          {/* Due installments list */}
          <div>
            <h4 className="font-semibold text-foreground mb-2">Due Installments</h4>
            {!loadingDue && due.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">No installments are due right now.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Member</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Loan #</th>
                      <th className="text-right font-medium text-muted-foreground px-3 py-2">Installment</th>
                      <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {due.map((r) => (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="px-3 py-2 font-medium text-foreground">{r.member_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.loan_number || "—"}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">#{r.installment_number || "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{money(r.amount || 0)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}
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
    </>
  );
}