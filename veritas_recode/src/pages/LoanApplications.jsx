import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ClipboardList,
  Check,
  X,
  Search,
  TrendingUp,
  Download,
} from "lucide-react";
import DateRangeFilter from "@/components/DateRangeFilter";
import { exportToCSV } from "@/lib/csvExport";
import { buildAmortizationSchedule, totalInterest } from "@/lib/amortization";
import { useMoney, moneyNow } from "@/lib/useMoney";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

export default function LoanApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [settings, setSettings] = useState(null);
  const { money, symbol } = useMoney();
  const [approveForm, setApproveForm] = useState({
    principal: 0,
    interest_rate: 0,
    term_months: 0,
    disbursement_date: "",
    payment_due_date: "",
    share_contribution: 0,
  });

  const load = async () => {
    try {
      const [data, allSettings, me] = await Promise.all([
        backend.entities.LoanApplication.list("-created_date"),
        backend.entities.InstitutionSetting.list().catch(() => []),
        backend.auth.me().catch(() => null),
      ]);
      setApplications(await scoped(data));
      setSettings(allSettings.find((s) => s.created_by_id === me?.id) || allSettings[0] || null);
    } finally {
      setLoading(false);
    }
  };

  const rateFor = (type) => {
    if (!settings) return 12;
    const r = type === "advance" ? settings.rate_advance : type === "emergency" ? settings.rate_emergency : settings.rate_normal;
    return Number(r) || 12;
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = applications.filter((a) => {
    const matchSearch =
      a.member_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.member_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchType = typeFilter === "all" || (a.loan_type || "normal") === typeFilter;
    const date = a.application_date;
    const matchFrom = !fromDate || (date && date >= fromDate);
    const matchTo = !toDate || (date && date <= toDate);
    return matchSearch && matchStatus && matchType && matchFrom && matchTo;
  });

  const openApprove = (app) => {
    setApproveTarget(app);
    setApproveForm({
      principal: app.requested_amount || 0,
      interest_rate: app.interest_rate || rateFor(app.loan_type),
      term_months: app.requested_term_months || 12,
      disbursement_date: new Date().toISOString().slice(0, 10),
      payment_due_date: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      share_contribution: 0,
    });
  };

  const handleApprove = async () => {
    const app = approveTarget;
    const principal = Number(approveForm.principal) || 0;
    const rate = Number(approveForm.interest_rate) || 0;
    const term = Number(approveForm.term_months) || 0;

    // Build a reducing-balance amortization schedule; the approved loan's
    // installment and total interest come from this schedule so the books match.
    const schedule =
      term > 0
        ? buildAmortizationSchedule({
            principal,
            interest_rate: rate,
            term_months: term,
            start_date: approveForm.payment_due_date || approveForm.disbursement_date,
          })
        : [];
    const installment_amount = schedule.length ? Math.round(schedule[0].payment) : 0;
    const interest_payable = Math.round(totalInterest(schedule));
    const balance = principal;

    // Create the actual loan record
    const appInstId = app.institution_id || (await institutionIdForCreate());
    const loan = await backend.entities.Loan.create({
      institution_id: appInstId,
      member_id: app.member_id,
      member_name: app.member_name,
      loan_number: `LN-${Date.now().toString().slice(-6)}`,
      principal,
      interest_rate: rate,
      term_months: term,
      balance,
      interest_payable,
      installment_amount,
      payment_due_date: approveForm.payment_due_date,
      status: "active",
      disbursement_date: approveForm.disbursement_date,
      ...(app.loan_source ? { loan_source: app.loan_source } : {}),
    });

    // Optionally record a share contribution
    const shareAmount = Number(approveForm.share_contribution) || 0;
    if (shareAmount > 0) {
      const existingShares = await backend.entities.Share.filter({
        member_id: app.member_id,
      });
      if (existingShares.length > 0) {
        const sh = existingShares[0];
        await backend.entities.Share.update(sh.id, {
          balance: (sh.balance || 0) + shareAmount,
          contributions_count: (sh.contributions_count || 0) + 1,
          last_contribution_date: approveForm.disbursement_date,
        });
      } else {
        await backend.entities.Share.create({
          institution_id: appInstId,
          member_id: app.member_id,
          member_name: app.member_name,
          balance: shareAmount,
          contributions_count: 1,
          last_contribution_date: approveForm.disbursement_date,
        });
      }
    }

    // Generate reducing-balance repayment schedule with interest/principal/balance breakdown
    if (schedule.length > 0) {
      const repayments = schedule.map((row) => ({
        institution_id: appInstId,
        loan_id: loan.id,
        member_id: app.member_id,
        member_name: app.member_name,
        loan_number: loan.loan_number,
        installment_number: row.installment,
        amount: Math.round(row.payment),
        interest_amount: Math.round(row.interest),
        principal_amount: Math.round(row.principal),
        balance: Math.round(row.balance),
        due_date: row.due_date,
        status: "pending",
      }));
      await backend.entities.Repayment.bulkCreate(repayments);
    }

    // Mark application as approved
    await backend.entities.LoanApplication.update(app.id, {
      status: "approved",
      admin_reason: "Loan approved and disbursed.",
      approved_loan_id: loan.id,
    });

    // Notify the member that their loan has been approved
    try {
      const mem = await backend.entities.Member.get(app.member_id);
      if (mem?.email) {
        await backend.integrations.Core.SendEmail({
          to: mem.email,
          from_name: "Veritas",
          subject: `Your loan has been approved — ${loan.loan_number}`,
          body: `Hello ${app.member_name},\n\nYour loan application has been approved and disbursed.\n\nLoan #: ${loan.loan_number}\nPrincipal: ${moneyNow(principal)}\nInterest Payable: ${moneyNow(interest_payable)}\nTerm: ${term} months\nMonthly Installment: ${moneyNow(installment_amount)}\nFirst Payment Due: ${approveForm.payment_due_date}\n\nView your loan in the Member Portal: ${window.location.origin}/portal\n\nRegards,\nThe Veritas Team`,
        });
      }
    } catch (e) {
      console.warn("Could not send loan approval email:", e);
    }

    setApproveTarget(null);
    load();
  };

  const handleReject = async () => {
    await backend.entities.LoanApplication.update(rejectTarget.id, {
      status: "rejected",
      admin_reason: rejectReason || "Application rejected.",
    });
    setRejectTarget(null);
    setRejectReason("");
    load();
  };

  const handleExport = () => {
    const rows = filtered.map((a) => ({
      Member: a.member_name || "",
      Number: a.member_number || "",
      Type: a.loan_type || "normal",
      Source: a.loan_source === "savings" ? "Savings (FOSA)" : a.loan_source === "shares" ? "Shares (BOSA)" : "",
      Requested: a.requested_amount || 0,
      Term_Months: a.requested_term_months || "",
      Purpose: a.purpose || "",
      Deduction_Start: a.deduction_start_date || "",
      Applied: a.application_date || "",
      Status: a.status || "",
      Admin_Notes: a.admin_reason || "",
    }));
    exportToCSV(
      rows,
      `loan-applications-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Member", "Number", "Type", "Source", "Requested", "Term_Months", "Purpose", "Deduction_Start", "Applied", "Status", "Admin_Notes"]
    );
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Loan Applications
          </h1>
          <p className="text-slate-500 mt-1">
            Review member loan applications — approve or reject with a reason
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Loan type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="advance">Advance</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
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

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Member
                  </th>
                  <th className="text-right font-medium text-slate-500 px-5 py-3">
                    Requested
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3 hidden sm:table-cell">
                    Purpose
                  </th>
                  <th className="text-right font-medium text-slate-500 px-5 py-3 hidden md:table-cell">
                    Term
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3 hidden lg:table-cell">
                    Type
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Status
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">
                        {a.member_name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {a.member_number}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                      {money(a.requested_amount || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden sm:table-cell max-w-xs truncate">
                      {a.purpose || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 hidden md:table-cell">
                      {a.requested_term_months || "—"} mo
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        (a.loan_type || "normal") === "emergency" ? "bg-rose-50 text-rose-700"
                        : (a.loan_type || "normal") === "advance" ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"}`}>
                        {a.loan_type || "normal"}
                      </span>
                      {a.loan_source && (
                        <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.loan_source === "savings" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {a.loan_source === "savings" ? "From Savings (FOSA)" : "From Shares (BOSA)"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          statusStyles[a.status]
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => openApprove(a)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejectTarget(a)}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          {a.admin_reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve & Disburse Loan</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 rounded-xl p-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Member</span>
                  <span className="font-medium text-slate-900">
                    {approveTarget.member_name} ({approveTarget.member_number})
                  </span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Requested</span>
                  <span className="font-medium text-slate-900">
                    {money(approveTarget.requested_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Purpose</span>
                  <span className="font-medium text-slate-900 text-right max-w-[60%]">
                    {approveTarget.purpose || "—"}
                  </span>
                </div>
              </div>
              {(approveTarget.guarantor_name || approveTarget.application_letter || approveTarget.member_signature) && (
                <div className="bg-amber-50 rounded-xl p-4 text-sm space-y-1">
                  <p className="font-medium text-amber-800 mb-1">Application Details</p>
                  {approveTarget.guarantor_name && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">Guarantor</span>
                      <span className="font-medium text-amber-900 text-right">{approveTarget.guarantor_name}{approveTarget.guarantor_id_number ? ` · ${approveTarget.guarantor_id_number}` : ""}</span>
                    </div>
                  )}
                  {approveTarget.guarantor_name && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">Guarantor Decision</span>
                      <span className={`font-medium capitalize ${approveTarget.guarantor_status === "accepted" ? "text-emerald-700" : approveTarget.guarantor_status === "rejected" ? "text-rose-700" : "text-amber-700"}`}>{approveTarget.guarantor_status || "pending"}</span>
                    </div>
                  )}
                  {approveTarget.member_signature && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">Member Signature</span>
                      <span className="font-medium text-amber-900 italic">{approveTarget.member_signature}</span>
                    </div>
                  )}
                  {approveTarget.application_letter && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">Application Letter</span>
                      <a href={approveTarget.application_letter} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline">View letter</a>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Principal ({symbol.trim()})</Label>
                  <Input
                    type="number"
                    value={approveForm.principal}
                    onChange={(e) =>
                      setApproveForm({
                        ...approveForm,
                        principal: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    value={approveForm.interest_rate}
                    onChange={(e) =>
                      setApproveForm({
                        ...approveForm,
                        interest_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Term (months)</Label>
                  <Input
                    type="number"
                    value={approveForm.term_months}
                    onChange={(e) =>
                      setApproveForm({
                        ...approveForm,
                        term_months: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Disbursement Date</Label>
                  <Input
                    type="date"
                    value={approveForm.disbursement_date}
                    onChange={(e) =>
                      setApproveForm({
                        ...approveForm,
                        disbursement_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>First Payment Due Date</Label>
                <Input
                  type="date"
                  value={approveForm.payment_due_date}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      payment_due_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <Label className="text-emerald-800">
                    Share Contribution (optional)
                  </Label>
                </div>
                <Input
                  type="number"
                  placeholder="Amount to add to member's shares"
                  value={approveForm.share_contribution}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      share_contribution: Number(e.target.value),
                    })
                  }
                />
              </div>
              {approveTarget.guarantor_name && approveTarget.guarantor_status !== "accepted" && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Note: the guarantor has not accepted this application yet.</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setApproveTarget(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApprove}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Approve & Disburse
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan Application</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 rounded-xl p-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Member</span>
                  <span className="font-medium text-slate-900">
                    {rejectTarget.member_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested</span>
                  <span className="font-medium text-slate-900">
                    {money(rejectTarget.requested_amount || 0)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Reason for rejection</Label>
                <Textarea
                  placeholder="Provide a reason for the member..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRejectTarget(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  className="flex-1 bg-rose-600 hover:bg-rose-700"
                >
                  Reject Application
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}