import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Banknote, Plus, Search, Pencil, Trash2, Download, CalendarClock, AlertCircle } from "lucide-react";
import DateRangeFilter from "@/components/DateRangeFilter";
import { exportToCSV } from "@/lib/csvExport";
import AmortizationSchedule from "@/components/AmortizationSchedule";
import AutomateLoanPaymentsButton from "@/components/loans/AutomateLoanPaymentsButton";
import { useMoney } from "@/lib/useMoney";
import { LOAN_COLLATERAL_MULTIPLIER, collateralBalance } from "@/lib/loanSource";

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  defaulted: "bg-rose-50 text-rose-700",
};

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [shares, setShares] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [scheduleLoan, setScheduleLoan] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [missedOnly, setMissedOnly] = useState(false);
  const { money, symbol } = useMoney();
  const [form, setForm] = useState({
    member_id: "",
    member_name: "",
    loan_source: "none",
    loan_number: "",
    principal: 0,
    interest_rate: 0,
    term_months: 0,
    balance: 0,
    interest_payable: 0,
    installment_amount: 0,
    payment_due_date: "",
    status: "pending",
    disbursement_date: "",
  });

  const load = async () => {
    try {
      const [loansData, membersData, repaymentsData, sharesData, accountsData] = await Promise.all([
        backend.entities.Loan.list(),
        backend.entities.Member.list(),
        backend.entities.Repayment.list("-due_date"),
        backend.entities.Share.list(),
        backend.entities.MemberAccount.list(),
      ]);
      setLoans(await scoped(loansData));
      setMembers(await scoped(membersData));
      setShares(await scoped(sharesData));
      setAccounts(await scoped(accountsData));
      setRepayments(repaymentsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const missedLoanIds = new Set(
    (repayments || []).filter((r) => r.status === "pending" && r.due_date && r.due_date < today).map((r) => r.loan_id)
  );
  const memberNumberById = Object.fromEntries(
    members.map((m) => [m.id, m.member_number || ""])
  );
  const filtered = loans.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      l.member_name?.toLowerCase().includes(q) ||
      l.loan_number?.toLowerCase().includes(q) ||
      memberNumberById[l.member_id]?.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "all" || l.status === statusFilter;
    const date = l.disbursement_date;
    const matchFrom = !fromDate || (date && date >= fromDate);
    const matchTo = !toDate || (date && date <= toDate);
    const matchMissed = !missedOnly || missedLoanIds.has(l.id);
    return matchSearch && matchStatus && matchFrom && matchTo && matchMissed;
  });

  const handleMemberChange = (memberId) => {
    const m = members.find((x) => x.id === memberId);
    setForm({ ...form, member_id: memberId, member_name: m?.full_name || "" });
  };

  const handleSubmit = async () => {
    const balance = form.balance || form.principal;
    const interest_payable = form.interest_payable || (form.principal * (form.interest_rate / 100) * (form.term_months / 12));
    const installment_amount = form.installment_amount || (form.term_months > 0 ? (balance + interest_payable) / form.term_months : 0);
    // Collateral rule: a loan sourced from shares (BOSA) or FOSA savings is
    // capped at a multiple of the member's balance in that source.
    const src = ["shares", "savings"].includes(form.loan_source) ? form.loan_source : "";
    const srcBalance = src ? collateralBalance(src, {
      shares: shares.filter((s) => s.member_id === form.member_id),
      accounts: accounts.filter((a) => a.member_id === form.member_id),
    }) : 0;
    if (src && (form.principal || 0) > srcBalance * LOAN_COLLATERAL_MULTIPLIER) {
      alert(`This loan is secured by ${src === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} of ${money(srcBalance)} — the principal cannot exceed ${LOAN_COLLATERAL_MULTIPLIER}× that (${money(srcBalance * LOAN_COLLATERAL_MULTIPLIER)}).`);
      return;
    }
    const payload = { ...form, balance, interest_payable, installment_amount };
    if (src) payload.loan_source = src;
    else delete payload.loan_source;
    if (editingId) {
      await backend.entities.Loan.update(editingId, payload);
    } else {
      await backend.entities.Loan.create({ ...payload, institution_id: await institutionIdForCreate() });
    }
    setOpen(false);
    setEditingId(null);
    setForm({
      member_id: "",
      member_name: "",
      loan_source: "none",
      loan_number: "",
      principal: 0,
      interest_rate: 0,
      term_months: 0,
      balance: 0,
      interest_payable: 0,
      installment_amount: 0,
      payment_due_date: "",
      status: "pending",
      disbursement_date: "",
    });
    load();
  };

  const handleEdit = (loan) => {
    setEditingId(loan.id);
    setForm({
      member_id: loan.member_id || "",
      member_name: loan.member_name || "",
      loan_number: loan.loan_number || "",
      principal: loan.principal || 0,
      interest_rate: loan.interest_rate || 0,
      term_months: loan.term_months || 0,
      balance: loan.balance || 0,
      interest_payable: loan.interest_payable || 0,
      installment_amount: loan.installment_amount || 0,
      payment_due_date: loan.payment_due_date || "",
      status: loan.status || "pending",
      disbursement_date: loan.disbursement_date || "",
      loan_source: loan.loan_source || "none",
    });
    setOpen(true);
  };

  const handleDelete = async (loanId) => {
    if (!confirm("Delete this loan record? This cannot be undone.")) return;
    await backend.entities.Loan.delete(loanId);
    load();
  };

  const handleExportMonthly = () => {
    const monthStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" }).toLowerCase().replace(" ", "-");
    const rows = filtered.map((l) => ({
      Loan_Number: l.loan_number || "",
      Member: l.member_name || "",
      Principal: l.principal || 0,
      Interest_Rate: l.interest_rate || 0,
      Term_Months: l.term_months || 0,
      Interest_Payable: l.interest_payable || 0,
      Outstanding_Balance: l.balance || 0,
      Monthly_Installment: l.installment_amount || 0,
      Status: l.status || "",
      Disbursement_Date: l.disbursement_date || "",
      Due_Date: l.payment_due_date || "",
    }));
    exportToCSV(rows, `loans-monthly-report-${monthStr}.csv`, ["Loan_Number","Member","Principal","Interest_Rate","Term_Months","Interest_Payable","Outstanding_Balance","Monthly_Installment","Status","Disbursement_Date","Due_Date"]);
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Loans Summary
          </h1>
          <p className="text-slate-500 mt-1">
            Summary of all issued loans — including counter disbursements from Banking
          </p>
        </div>
        <div className="flex gap-2">
          <AutomateLoanPaymentsButton />
          <Button variant="outline" onClick={handleExportMonthly} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export Monthly
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Loan
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Loan Record" : "Add Loan Record"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Member</Label>
                <Select onValueChange={handleMemberChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name} ({m.member_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loan Source (collateral)</Label>
                <Select
                  value={form.loan_source}
                  onValueChange={(v) => setForm({ ...form, loan_source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="shares">From Shares (BOSA)</SelectItem>
                    <SelectItem value="savings">From Savings (FOSA)</SelectItem>
                  </SelectContent>
                </Select>
                {form.member_id && ["shares", "savings"].includes(form.loan_source) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {form.loan_source === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} collateral:{" "}
                    {money(collateralBalance(form.loan_source, {
                      shares: shares.filter((s) => s.member_id === form.member_id),
                      accounts: accounts.filter((a) => a.member_id === form.member_id),
                    }))}{" "}— principal capped at {LOAN_COLLATERAL_MULTIPLIER}×.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Loan Number</Label>
                  <Input
                    value={form.loan_number}
                    onChange={(e) =>
                      setForm({ ...form, loan_number: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Principal ({symbol.trim()})</Label>
                  <Input
                    type="number"
                    value={form.principal}
                    onChange={(e) =>
                      setForm({ ...form, principal: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    value={form.interest_rate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        interest_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Term (months)</Label>
                  <Input
                    type="number"
                    value={form.term_months}
                    onChange={(e) =>
                      setForm({ ...form, term_months: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Interest Payable ({symbol.trim()})</Label>
                  <Input
                    type="number"
                    value={form.interest_payable}
                    onChange={(e) =>
                      setForm({ ...form, interest_payable: Number(e.target.value) })
                    }
                    placeholder="Auto-calculated if empty"
                  />
                </div>
                <div>
                  <Label>Monthly Installment ({symbol.trim()})</Label>
                  <Input
                    type="number"
                    value={form.installment_amount}
                    onChange={(e) =>
                      setForm({ ...form, installment_amount: Number(e.target.value) })
                    }
                    placeholder="Auto-calculated if empty"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Due Date</Label>
                  <Input
                    type="date"
                    value={form.payment_due_date}
                    onChange={(e) =>
                      setForm({ ...form, payment_due_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="defaulted">Defaulted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Disbursement Date</Label>
                <Input
                  type="date"
                  value={form.disbursement_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      disbursement_date: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                onClick={handleSubmit}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {editingId ? "Update Loan Record" : "Save Loan Record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search loans..."
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
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="defaulted">Defaulted</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={missedOnly ? "default" : "outline"}
          onClick={() => setMissedOnly(!missedOnly)}
          className={missedOnly ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
          title="Show only loans with overdue installments"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Missed Installments{missedLoanIds.size > 0 ? ` (${missedLoanIds.size})` : ""}
        </Button>
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          onClear={() => { setFromDate(""); setToDate(""); }}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No loan records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Member
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3 hidden sm:table-cell">
                    Loan #
                  </th>
                  <th className="text-right font-medium text-slate-500 px-5 py-3">
                    Principal
                  </th>
                  <th className="text-right font-medium text-slate-500 px-5 py-3 hidden lg:table-cell">
                    Interest
                  </th>
                  <th className="text-right font-medium text-slate-500 px-5 py-3 hidden md:table-cell">
                    Balance
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3 hidden xl:table-cell">
                    Due Date
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Status
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {l.member_name}
                      {l.loan_source && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          l.loan_source === "savings" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {l.loan_source === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden sm:table-cell">
                      {l.loan_number || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-900">
                      {money(l.principal || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-rose-600 font-medium hidden lg:table-cell">
                      {money(l.interest_payable || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900 hidden md:table-cell">
                      {money(l.balance || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden xl:table-cell">
                      {l.payment_due_date
                        ? new Date(l.payment_due_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusStyles[l.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {l.status}
                        </span>
                        {missedLoanIds.has(l.id) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
                            <AlertCircle className="w-3 h-3 mr-1" />Missed installment
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="Amortization schedule" onClick={() => setScheduleLoan(l)}>
                          <CalendarClock className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-700" onClick={() => handleEdit(l)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-rose-600" onClick={() => handleDelete(l.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">Total</td>
                    <td className="px-5 py-3 hidden sm:table-cell"></td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">
                      {money(filtered.reduce((s, l) => s + (l.principal || 0), 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-rose-600 hidden lg:table-cell">
                      {money(filtered.reduce((s, l) => s + (l.interest_payable || 0), 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900 hidden md:table-cell">
                      {money(filtered.reduce((s, l) => s + (l.balance || 0), 0))}
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell"></td>
                    <td className="px-5 py-3"></td>
                    <td className="px-5 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Amortization schedule viewer */}
      <Dialog open={!!scheduleLoan} onOpenChange={(o) => !o && setScheduleLoan(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Amortization Schedule</DialogTitle>
          </DialogHeader>
          {scheduleLoan && (
            <AmortizationSchedule loan={scheduleLoan} memberName={scheduleLoan.member_name} />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}