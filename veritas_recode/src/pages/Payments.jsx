import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Smartphone, Search, Check, X, Clock, CreditCard, UserPlus, Trash2, CheckCheck } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

const statusStyles = {
  pending: "bg-amber-950/50 text-amber-400 border-amber-800/50",
  approved: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
  rejected: "bg-rose-950/50 text-rose-400 border-rose-800/50",
};

const SUBSCRIPTION_FEE = 50;

export default function Payments() {
  const [loanPayments, setLoanPayments] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectType, setRejectType] = useState("loan");
  const [selectedLoanPayments, setSelectedLoanPayments] = useState(new Set());
  const [selectedMemberPayments, setSelectedMemberPayments] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const { money } = useMoney();

  const load = async () => {
    try {
      const [lp, mp] = await Promise.all([
        backend.entities.LoanPayment.list("-payment_date"),
        backend.entities.MemberPayment.list("-payment_date"),
      ]);
      setLoanPayments(await scoped(lp));
      setMemberPayments(await scoped(mp));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredLoanPayments = loanPayments.filter((p) => {
    const matchSearch =
      p.member_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.payment_ref?.toLowerCase().includes(search.toLowerCase()) ||
      p.loan_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchFrom = !fromDate || (p.payment_date && p.payment_date >= fromDate);
    const matchTo = !toDate || (p.payment_date && p.payment_date <= toDate);
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const filteredMemberPayments = memberPayments.filter((p) => {
    const matchSearch =
      p.member_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.payment_ref?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchFrom = !fromDate || (p.payment_date && p.payment_date >= fromDate);
    const matchTo = !toDate || (p.payment_date && p.payment_date <= toDate);
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const handleApproveLoanPayment = async (payment) => {
    const today = new Date().toISOString().slice(0, 10);
    const repayments = await backend.entities.Repayment.filter({ loan_id: payment.loan_id, status: "pending" });
    if (repayments.length > 0) {
      const repayment = repayments[0];
      await backend.entities.Repayment.update(repayment.id, { status: "paid", payment_date: today });
      await backend.entities.LoanPayment.update(payment.id, {
        status: "approved",
        admin_reason: "Payment verified and applied to repayment schedule.",
        repayment_id: repayment.id,
      });
    } else {
      await backend.entities.LoanPayment.update(payment.id, {
        status: "approved",
        admin_reason: "Payment verified (no pending installment found).",
      });
    }
    const loan = await backend.entities.Loan.get(payment.loan_id);
    const newBalance = (loan.balance || 0) - (payment.amount || 0);
    const updates = { balance: Math.max(0, newBalance) };
    if (newBalance <= 0) updates.status = "paid";
    await backend.entities.Loan.update(payment.loan_id, updates);
    load();
  };

  const handleApproveMemberPayment = async (payment) => {
    if (payment.payment_type === "shares") {
      // Find or create share record and increase balance
      const existingShares = await backend.entities.Share.filter({ member_id: payment.member_id });
      const today = new Date().toISOString().slice(0, 10);
      if (existingShares.length > 0) {
        const sh = existingShares[0];
        await backend.entities.Share.update(sh.id, {
          balance: (sh.balance || 0) + (payment.amount || 0),
          contributions_count: (sh.contributions_count || 0) + 1,
          last_contribution_date: today,
        });
      } else {
        const member = await backend.entities.Member.get(payment.member_id);
        await backend.entities.Share.create({
          institution_id: payment.institution_id || (await institutionIdForCreate()),
          member_id: payment.member_id,
          member_name: payment.member_name,
          balance: payment.amount,
          contributions_count: 1,
          last_contribution_date: today,
        });
      }
    } else if (payment.payment_type === "subscription") {
      // Activate member and mark subscription as paid
      await backend.entities.Member.update(payment.member_id, {
        subscription_status: "paid",
        status: "active",
      });
    }
    await backend.entities.MemberPayment.update(payment.id, {
      status: "approved",
      admin_reason: `${payment.payment_type === "shares" ? "Share purchase" : "Subscription fee"} verified and applied.`,
    });
    load();
  };

  const toggleLoanPayment = (id) => {
    const next = new Set(selectedLoanPayments);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedLoanPayments(next);
  };

  const toggleMemberPayment = (id) => {
    const next = new Set(selectedMemberPayments);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedMemberPayments(next);
  };

  const toggleAllLoanPayments = () => {
    const pendingIds = filteredLoanPayments.filter((p) => p.status === "pending").map((p) => p.id);
    if (pendingIds.every((id) => selectedLoanPayments.has(id))) {
      const next = new Set(selectedLoanPayments);
      pendingIds.forEach((id) => next.delete(id));
      setSelectedLoanPayments(next);
    } else {
      const next = new Set(selectedLoanPayments);
      pendingIds.forEach((id) => next.add(id));
      setSelectedLoanPayments(next);
    }
  };

  const toggleAllMemberPayments = () => {
    const pendingIds = filteredMemberPayments.filter((p) => p.status === "pending").map((p) => p.id);
    if (pendingIds.every((id) => selectedMemberPayments.has(id))) {
      const next = new Set(selectedMemberPayments);
      pendingIds.forEach((id) => next.delete(id));
      setSelectedMemberPayments(next);
    } else {
      const next = new Set(selectedMemberPayments);
      pendingIds.forEach((id) => next.add(id));
      setSelectedMemberPayments(next);
    }
  };

  const handleBulkApproveLoanPayments = async () => {
    const toApprove = filteredLoanPayments.filter((p) => selectedLoanPayments.has(p.id) && p.status === "pending");
    if (toApprove.length === 0) return;
    setBulkProcessing(true);
    for (const p of toApprove) {
      try { await handleApproveLoanPayment(p); } catch {}
    }
    setSelectedLoanPayments(new Set());
    setBulkProcessing(false);
  };

  const handleBulkApproveMemberPayments = async () => {
    const toApprove = filteredMemberPayments.filter((p) => selectedMemberPayments.has(p.id) && p.status === "pending");
    if (toApprove.length === 0) return;
    setBulkProcessing(true);
    for (const p of toApprove) {
      try { await handleApproveMemberPayment(p); } catch {}
    }
    setSelectedMemberPayments(new Set());
    setBulkProcessing(false);
  };

  const handleDeleteLoanPayment = async (paymentId) => {
    if (!confirm("Delete this loan payment record? This cannot be undone.")) return;
    await backend.entities.LoanPayment.delete(paymentId);
    load();
  };

  const handleDeleteMemberPayment = async (paymentId) => {
    if (!confirm("Delete this payment record? This cannot be undone.")) return;
    await backend.entities.MemberPayment.delete(paymentId);
    load();
  };

  const handleReject = async () => {
    if (rejectType === "loan") {
      await backend.entities.LoanPayment.update(rejectTarget.id, {
        status: "rejected",
        admin_reason: rejectReason || "Payment rejected.",
      });
    } else {
      await backend.entities.MemberPayment.update(rejectTarget.id, {
        status: "rejected",
        admin_reason: rejectReason || "Payment rejected.",
      });
    }
    setRejectTarget(null);
    setRejectReason("");
    load();
  };

  const loanPending = loanPayments.filter((p) => p.status === "pending").length;
  const memberPending = memberPayments.filter((p) => p.status === "pending").length;
  const totalApproved = [...loanPayments, ...memberPayments].filter((p) => p.status === "approved").length;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold gold-text tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-1">
          Verify and approve member payments (loans, subscriptions, shares)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="luxury-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-950/50 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{loanPending + memberPending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>
        <div className="luxury-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-950/50 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{totalApproved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
        </div>
        <div className="luxury-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-950/50 flex items-center justify-center">
            <X className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">
              {[...loanPayments, ...memberPayments].filter((p) => p.status === "rejected").length}
            </p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by member or ref..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter fromDate={fromDate} toDate={toDate}
          onFromChange={setFromDate} onToChange={setToDate}
          onClear={() => { setFromDate(""); setToDate(""); }} />
      </div>

      <Tabs defaultValue="loan-payments">
        <TabsList className="mb-4">
          <TabsTrigger value="loan-payments">
            <Smartphone className="w-4 h-4 mr-2" />
            Loan Payments {loanPending > 0 && `(${loanPending})`}
          </TabsTrigger>
          <TabsTrigger value="member-payments">
            <UserPlus className="w-4 h-4 mr-2" />
            Subscriptions & Shares {memberPending > 0 && `(${memberPending})`}
          </TabsTrigger>
        </TabsList>

        {/* Loan Payments Tab */}
        <TabsContent value="loan-payments">
          <div className="luxury-card rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">Loading...</div>
            ) : filteredLoanPayments.length === 0 ? (
              <div className="p-12 text-center">
                <Smartphone className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No loan payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          onChange={toggleAllLoanPayments}
                          checked={filteredLoanPayments.filter((p) => p.status === "pending").length > 0 && filteredLoanPayments.filter((p) => p.status === "pending").every((p) => selectedLoanPayments.has(p.id))}
                        />
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Member</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Loan #</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Ref</th>
                      <th className="text-right font-medium text-muted-foreground px-5 py-3">Amount</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoanPayments.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-3 py-3.5">
                          {p.status === "pending" && (
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={selectedLoanPayments.has(p.id)}
                              onChange={() => toggleLoanPayment(p.id)}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-foreground">{p.member_name}</div>
                          <div className="text-xs text-muted-foreground">{p.member_number}</div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{p.loan_number || "—"}</td>
                        <td className="px-5 py-3.5">
                          <code className="text-xs px-2 py-0.5 bg-muted rounded text-foreground">{p.payment_ref}</code>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-foreground">{money(p.amount || 0)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[p.status]}`}>{p.status}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {p.status === "pending" ? (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => handleApproveLoanPayment(p)} className="bg-emerald-700 hover:bg-emerald-800">
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setRejectTarget(p); setRejectType("loan"); }} className="text-rose-500 border-rose-800/50 hover:bg-rose-950/30">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-500 p-0" onClick={() => handleDeleteLoanPayment(p.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground italic max-w-[120px] block truncate">{p.admin_reason}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-500" onClick={() => handleDeleteLoanPayment(p.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredLoanPayments.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/20 border-t-2 border-border">
                        <td className="px-3 py-3"></td>
                        <td colSpan={3} className="px-5 py-3 font-semibold text-foreground">Total</td>
                        <td className="px-5 py-3 text-right font-bold text-primary">
                          {money(filteredLoanPayments.reduce((s, p) => s + (p.amount || 0), 0))}
                        </td>
                        <td colSpan={3} className="px-5 py-3">
                          {selectedLoanPayments.size > 0 && (
                            <Button size="sm" onClick={handleBulkApproveLoanPayments} disabled={bulkProcessing} className="bg-emerald-700 hover:bg-emerald-800 ml-auto">
                              <CheckCheck className="w-3.5 h-3.5 mr-1" />
                              {bulkProcessing ? "Processing..." : `Approve ${selectedLoanPayments.size} Selected`}
                            </Button>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Member Payments Tab */}
        <TabsContent value="member-payments">
          <div className="luxury-card rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">Loading...</div>
            ) : filteredMemberPayments.length === 0 ? (
              <div className="p-12 text-center">
                <UserPlus className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No subscription or share payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          onChange={toggleAllMemberPayments}
                          checked={filteredMemberPayments.filter((p) => p.status === "pending").length > 0 && filteredMemberPayments.filter((p) => p.status === "pending").every((p) => selectedMemberPayments.has(p.id))}
                        />
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Member</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Type</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Method</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Ref</th>
                      <th className="text-right font-medium text-muted-foreground px-5 py-3">Amount</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-3">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemberPayments.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-3 py-3.5">
                          {p.status === "pending" && (
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={selectedMemberPayments.has(p.id)}
                              onChange={() => toggleMemberPayment(p.id)}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-foreground">{p.member_name}</div>
                          <div className="text-xs text-muted-foreground">{p.member_number}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${p.payment_type === "shares" ? "bg-blue-950/50 text-blue-400" : "bg-purple-950/50 text-purple-400"}`}>
                            {p.payment_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell capitalize">{p.payment_method}</td>
                        <td className="px-5 py-3.5">
                          <code className="text-xs px-2 py-0.5 bg-muted rounded text-foreground">{p.payment_ref}</code>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-foreground">{money(p.amount || 0)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[p.status]}`}>{p.status}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {p.status === "pending" ? (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => handleApproveMemberPayment(p)} className="bg-emerald-700 hover:bg-emerald-800">
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setRejectTarget(p); setRejectType("member"); }} className="text-rose-500 border-rose-800/50 hover:bg-rose-950/30">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-500 p-0" onClick={() => handleDeleteMemberPayment(p.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground italic max-w-[120px] block truncate">{p.admin_reason}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-500" onClick={() => handleDeleteMemberPayment(p.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredMemberPayments.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/20 border-t-2 border-border">
                        <td className="px-3 py-3"></td>
                        <td colSpan={4} className="px-5 py-3 font-semibold text-foreground">Total</td>
                        <td className="px-5 py-3 text-right font-bold text-primary">
                          {money(filteredMemberPayments.reduce((s, p) => s + (p.amount || 0), 0))}
                        </td>
                        <td colSpan={3} className="px-5 py-3">
                          {selectedMemberPayments.size > 0 && (
                            <Button size="sm" onClick={handleBulkApproveMemberPayments} disabled={bulkProcessing} className="bg-emerald-700 hover:bg-emerald-800 ml-auto">
                              <CheckCheck className="w-3.5 h-3.5 mr-1" />
                              {bulkProcessing ? "Processing..." : `Approve ${selectedMemberPayments.size} Selected`}
                            </Button>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Payment</DialogTitle></DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/30 rounded-xl p-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Member</span>
                  <span className="font-medium text-foreground">{rejectTarget.member_name}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-foreground">{money(rejectTarget.amount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium text-foreground">{rejectTarget.payment_ref}</span>
                </div>
              </div>
              <div>
                <Label>Reason for rejection</Label>
                <Textarea placeholder="Provide a reason..." value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setRejectTarget(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleReject} className="flex-1 bg-rose-600 hover:bg-rose-700">Reject Payment</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}