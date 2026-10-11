import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Search,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  CalendarClock,
  Pencil,
  Trash2,
} from "lucide-react";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AmortizationSchedule from "@/components/AmortizationSchedule";
import { exportToCSV } from "@/lib/csvExport";
import { useMoney, moneyNow } from "@/lib/useMoney";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function RepaymentSchedule() {
  const [repayments, setRepayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [scheduleLoan, setScheduleLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ amount: 0, due_date: "", interest_amount: 0, principal_amount: 0 });
  const [savingEdit, setSavingEdit] = useState(false);
  const [loanPayments, setLoanPayments] = useState([]);
  const { money } = useMoney();

  const load = async () => {
    try {
      const [r, m, l, lp] = await Promise.all([
        backend.entities.Repayment.list("-due_date"),
        backend.entities.Member.list(),
        backend.entities.Loan.list(),
        backend.entities.LoanPayment.list("-payment_date"),
      ]);
      setRepayments(r);
      setMembers(await scoped(m));
      setLoans(await scoped(l));
      setLoanPayments(await scoped(lp));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = repayments.filter((r) => {
    const matchSearch =
      r.member_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.loan_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchFrom = !fromDate || (r.due_date && r.due_date >= fromDate);
    const matchTo = !toDate || (r.due_date && r.due_date <= toDate);
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const markPaid = async (repayment) => {
    await backend.entities.Repayment.update(repayment.id, {
      status: "paid",
      payment_date: new Date().toISOString().slice(0, 10),
    });
    load();
  };

  const openEdit = (r) => {
    setEditTarget(r);
    setEditForm({
      amount: r.amount || 0,
      due_date: r.due_date || "",
      interest_amount: r.interest_amount || 0,
      principal_amount: r.principal_amount || 0,
    });
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const oldAmount = editTarget.amount || 0;
      const newAmount = Number(editForm.amount) || 0;
      const oldInterest = editTarget.interest_amount || 0;
      const newInterest = Number(editForm.interest_amount) || 0;
      const oldPrincipal = editTarget.principal_amount || 0;
      const newPrincipal = Number(editForm.principal_amount) || 0;
      const balance = Math.max(0, (editTarget.balance || 0) + (oldAmount - newAmount));
      await backend.entities.Repayment.update(editTarget.id, {
        amount: newAmount,
        due_date: editForm.due_date || null,
        interest_amount: newInterest,
        principal_amount: newPrincipal,
        balance,
      });

      // Reflect the edit in the cash-in balance: sync the linked approved
      // loan payment (created by auto-deduction) and adjust the loan's
      // outstanding balance / interest payable for principal & interest changes.
      const linked = loanPayments.find((p) => p.repayment_id === editTarget.id && p.status === "approved");
      if (linked) {
        await backend.entities.LoanPayment.update(linked.id, { amount: newAmount }).catch(() => {});
        if (editTarget.loan_id) {
          try {
            const loan = await backend.entities.Loan.get(editTarget.loan_id);
            const principalDelta = newPrincipal - oldPrincipal;
            const interestDelta = newInterest - oldInterest;
            const upd = {
              balance: Math.max(0, (loan.balance || 0) - principalDelta),
              interest_payable: Math.max(0, (loan.interest_payable || 0) - interestDelta),
            };
            if (upd.balance <= 0 && newPrincipal > 0) upd.status = "paid";
            else if (loan.status === "paid") upd.status = "active";
            await backend.entities.Loan.update(editTarget.loan_id, upd);
          } catch {}
        }
      }

      setEditTarget(null);
      load();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Remove installment #${r.installment_number} for ${r.member_name}? Any cash-in already collected for this installment will be reversed.`)) return;
    // Reverse the linked approved loan payment so the cash-in balance drops.
    const linked = loanPayments.find((p) => p.repayment_id === r.id && p.status === "approved");
    if (linked) {
      await backend.entities.LoanPayment.delete(linked.id).catch(() => {});
      if (r.loan_id) {
        try {
          const loan = await backend.entities.Loan.get(r.loan_id);
          const upd = {
            balance: (loan.balance || 0) + (r.principal_amount || 0),
            interest_payable: (loan.interest_payable || 0) + (r.interest_amount || 0),
          };
          if (loan.status === "paid") upd.status = "active";
          await backend.entities.Loan.update(r.loan_id, upd);
        } catch {}
      }
    }
    await backend.entities.Repayment.delete(r.id);
    load();
  };

  const sendDueReminders = async () => {
    setSending(true);
    setResult(null);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = repayments.filter(
      (r) =>
        r.status === "pending" &&
        r.due_date &&
        r.due_date >= today &&
        new Date(r.due_date).getTime() - Date.now() <= 7 * 86400000
    );

    if (upcoming.length === 0) {
      setResult({
        type: "info",
        message: "No repayments due in the next 7 days.",
      });
      setSending(false);
      return;
    }

    let sent = 0;
    let failed = 0;
    for (const r of upcoming) {
      const member = members.find((m) => m.id === r.member_id);
      if (!member?.email) {
        failed++;
        continue;
      }
      try {
        await backend.integrations.Core.SendEmail({
          to: member.email,
          subject: `Loan Repayment Due — ${r.loan_number || "Your Loan"}`,
          body: `Dear ${member.full_name},\n\nThis is a reminder that your loan repayment of ${moneyNow(r.amount)} is due on ${new Date(r.due_date).toLocaleDateString()}.\n\nLoan Number: ${r.loan_number || "—"}\nInstallment: #${r.installment_number}\nAmount Due: ${moneyNow(r.amount)}\nDue Date: ${new Date(r.due_date).toLocaleDateString()}\n\nPlease ensure timely payment to avoid penalties.\n\nThank you,\nVeritas Team`,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    setResult({
      type: sent > 0 ? "success" : "error",
      message: `${sent} reminder(s) sent${failed > 0 ? `, ${failed} failed (no email on file)` : ""}.`,
    });
    setSending(false);
  };

  const handleExportRepayments = () => {
    const rows = filtered.map((r) => ({
      Member: r.member_name || "",
      Loan_Number: r.loan_number || "",
      Installment: r.installment_number || "",
      Amount: r.amount || 0,
      Interest: r.interest_amount || 0,
      Principal: r.principal_amount || 0,
      Balance: r.balance || 0,
      Due_Date: r.due_date || "",
      Status: r.status || "",
    }));
    exportToCSV(
      rows,
      `repayment-schedule-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Member", "Loan_Number", "Installment", "Amount", "Interest", "Principal", "Balance", "Due_Date", "Status"]
    );
  };

  const today = new Date().toISOString().slice(0, 10);
  const dueCount = repayments.filter(
    (r) => r.status === "pending" && r.due_date && r.due_date >= today
  ).length;
  const overdueCount = repayments.filter(
    (r) => r.status === "pending" && r.due_date && r.due_date < today
  ).length;

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            Repayment Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            Track scheduled loan repayments and send due reminders
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportRepayments} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={sendDueReminders}
            disabled={sending}
            className="bg-primary hover:bg-primary/90"
          >
            <Mail className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : "Send Due Reminders"}
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{dueCount}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{overdueCount}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">
              {repayments.filter((r) => r.status === "paid").length}
            </p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`mb-6 flex items-center gap-2 p-4 rounded-xl text-sm font-medium ${
            result.type === "success"
              ? "bg-emerald-50 text-emerald-800"
              : result.type === "error"
              ? "bg-rose-50 text-rose-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by member or loan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          onClear={() => { setFromDate(""); setToDate(""); }}
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No repayment records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">
                    Member
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">
                    Loan #
                  </th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">
                    Installment
                  </th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3">
                    Amount
                  </th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">
                    Interest
                  </th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">
                    Principal
                  </th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">
                    Balance
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">
                    Due Date
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">
                    Status
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isOverdue =
                    r.status === "pending" &&
                    r.due_date &&
                    r.due_date < today;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {r.member_name}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                        {r.loan_number || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center text-muted-foreground hidden md:table-cell">
                        #{r.installment_number}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-foreground">
                        {money(r.amount || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-rose-600 hidden lg:table-cell">
                        {money(r.interest_amount || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-emerald-700 hidden lg:table-cell">
                        {money(r.principal_amount || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground hidden lg:table-cell">
                        {money(r.balance || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {r.due_date
                          ? new Date(r.due_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            statusStyles[isOverdue ? "overdue" : r.status]
                          }`}
                        >
                          {isOverdue ? "overdue" : r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(r)}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                            title="Adjust this installment"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setScheduleLoan(loans.find((l) => l.id === r.loan_id))}
                            className="text-primary border-primary/30 hover:bg-primary/10"
                            title="View / download amortization schedule"
                          >
                            <CalendarClock className="w-3.5 h-3.5 mr-1" />
                            Schedule
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(r)}
                            className="text-rose-700 border-rose-200 hover:bg-rose-50"
                            title="Remove this installment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          {r.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPaid(r)}
                              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!scheduleLoan} onOpenChange={(o) => !o && setScheduleLoan(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Amortization Schedule</DialogTitle>
          </DialogHeader>
          {scheduleLoan && <AmortizationSchedule loan={scheduleLoan} memberName={scheduleLoan.member_name} />}
        </DialogContent>
      </Dialog>

      {/* Edit installment */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Installment #{editTarget?.installment_number}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/30 rounded-xl p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span className="font-medium text-foreground">{editTarget.member_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Loan</span><span className="font-medium text-foreground">{editTarget.loan_number || "—"}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Installment Amount</Label>
                  <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                </div>
                <div>
                  <Label>Interest Portion</Label>
                  <Input type="number" value={editForm.interest_amount} onChange={(e) => setEditForm({ ...editForm, interest_amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Principal Portion</Label>
                  <Input type="number" value={editForm.principal_amount} onChange={(e) => setEditForm({ ...editForm, principal_amount: Number(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">The outstanding balance will be adjusted by the change in installment amount.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditTarget(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 bg-primary hover:bg-primary/90">
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}