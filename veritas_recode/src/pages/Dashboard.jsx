import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import {
  Users, TrendingUp, Banknote, Wallet, ArrowUpRight, ClipboardList,
  Calendar, Mail, Percent, Download, PiggyBank, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/csvExport";
import { toast } from "@/components/ui/use-toast";
import { exportBankSummaryExcel } from "@/lib/bankSummaryExport";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { processDueDeductions } from "@/lib/autoDeduction";
import { computeInstitutionBankBalance } from "@/lib/institutionBalance";
import { MASKED_BALANCE } from "@/lib/bankBalanceVisibility";
import { useMoney, moneyNow, symbolNow } from "@/lib/useMoney";
import PhysicalDepositPanel from "@/components/dashboard/PhysicalDepositPanel";
import BroadcastMessagesPanel from "@/components/dashboard/BroadcastMessagesPanel";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import AnimatedCounter from "@/components/AnimatedCounter";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notifResult, setNotifResult] = useState(null);
  const [institution, setInstitution] = useState(null);
  const { money, symbol } = useMoney();
  const [depositMode, setDepositMode] = useState("auto");
  const [showBalance, setShowBalance] = useState(true);
  const [instSetting, setInstSetting] = useState(null);
  const [savingMode, setSavingMode] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);

  const load = async () => {
    try {
      let [members, loans, shares, applications, repayments, loanPayments, memberPayments, institutions, me, journal, shareTx, settings] =
        await Promise.all([
          backend.entities.Member.list(),
          backend.entities.Loan.list(),
          backend.entities.Share.list(),
          backend.entities.LoanApplication.list("-created_date"),
          backend.entities.Repayment.list("-due_date"),
          backend.entities.LoanPayment.list("-payment_date"),
          backend.entities.MemberPayment.list("-payment_date"),
          backend.entities.Institution.list().catch(() => []),
          backend.auth.me().catch(() => null),
          backend.entities.JournalEntry.list().catch(() => []),
          backend.entities.ShareTransaction.list().catch(() => []),
          backend.entities.InstitutionSetting.list().catch(() => []),
        ]);
      // Multi-tenant isolation: scope every dataset to this institution's console
      [members, loans, shares, applications, loanPayments, memberPayments] = await Promise.all([
        scoped(members), scoped(loans), scoped(shares), scoped(applications), scoped(loanPayments), scoped(memberPayments),
      ]);
      const inst = (me && institutions.find((i) => i.admin_user_id === me.id)) || (me?.institution_id && institutions.find((i) => i.id === me.institution_id)) || institutions.find((i) => i.status === "approved") || null;
      setInstitution(inst);
      const setting = (inst && settings.find((s) => s.institution_id === inst.id)) || settings[0] || null;
      setInstSetting(setting);
      const mode = setting?.deposit_mode === "manual" ? "manual" : "auto";
      setDepositMode(mode);
      setShowBalance(setting?.show_bank_balance !== false);

      // Auto-deduct due loan installments (principal + interest) into the bank
      // balance only when deposit mode is "auto". In "manual" mode the admin
      // physically deposits repayments, registration fees and other income.
      const autoPayments = mode === "auto" ? await processDueDeductions(backend, { repayments, loanPayments }) : [];
      if (autoPayments.length > 0) {
        const [r2, lp2, l2] = await Promise.all([
          backend.entities.Repayment.list("-due_date"),
          backend.entities.LoanPayment.list("-payment_date"),
          backend.entities.Loan.list(),
        ]);
        repayments = r2; loanPayments = await scoped(lp2); loans = await scoped(l2);
      }

      // Bank balance — shared single source of truth (also keeps the linked
      // "Bank Accounts" row in the Chart of Accounts in sync).
      const { bankBalance, cashInflows, cashOutflows } = computeInstitutionBankBalance({ loans, loanPayments, memberPayments, journal, shareTx });

      const activeLoans = loans.filter((l) => l.status === "active");
      const pendingApps = applications.filter((a) => a.status === "pending");
      const today = new Date().toISOString().slice(0, 10);
      const upcomingRepayments = repayments
        .filter((r) => r.status === "pending" && r.due_date && r.due_date >= today)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 5);

      // Pending payments across all types
      const pendingLoanPayments = loanPayments.filter((p) => p.status === "pending");
      const pendingMemberPayments = memberPayments.filter((p) => p.status === "pending");

      // Recent interest income (last 30 days of approved loan payments)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentApprovedPayments = loanPayments.filter(
        (p) => p.status === "approved" && p.payment_date && new Date(p.payment_date) >= thirtyDaysAgo
      );
      // Interest portion: approximate as the interest_payable proportion of each loan
      const recentInterestIncome = recentApprovedPayments.reduce((s, p) => {
        const loan = loans.find((l) => l.id === p.loan_id);
        if (!loan || !loan.principal) return s;
        const interestRatio = (loan.interest_payable || 0) / (loan.principal + (loan.interest_payable || 0));
        return s + (p.amount || 0) * interestRatio;
      }, 0);

      setData({
        members, loans, shares, applications, repayments,
        loanPayments, memberPayments,
        activeLoans, pendingApps, upcomingRepayments,
        pendingLoanPayments, pendingMemberPayments,
        recentInterestIncome,
        bankBalance, cashInflows, cashOutflows,
        journal, shareTx,
        stats: {
          totalMembers: members.length,
          activeLoans: activeLoans.length,
          totalShares: shares.reduce((s, sh) => s + (sh.balance || 0), 0),
          outstandingLoans: activeLoans.reduce((s, l) => s + (l.balance || 0), 0),
          totalInterest: activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0),
          pendingApps: pendingApps.length,
          totalBorrowed: loans.reduce((s, l) => s + (l.principal || 0), 0),
          pendingPayments: pendingLoanPayments.length + pendingMemberPayments.length,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Real-time subscriptions
    const unsubs = [];
    try { unsubs.push(backend.entities.LoanPayment.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.MemberPayment.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.Loan.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.Share.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.Member.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.JournalEntry.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.ShareTransaction.subscribe(() => load())); } catch {}
    return () => unsubs.forEach((u) => u && u());
  }, []);

  const sendInterestNotifications = async () => {
    if (!data) return;
    setSending(true);
    setNotifResult(null);
    const membersWithEmail = data.members.filter((m) => m.email);
    let sent = 0, failed = 0;

    for (const loan of data.activeLoans) {
      const member = membersWithEmail.find((m) => m.id === loan.member_id);
      if (!member) { failed++; continue; }
      try {
        await backend.integrations.Core.SendEmail({
          to: member.email,
          subject: `Interest Balance Update — ${loan.loan_number || "Your Loan"}`,
          body: `Dear ${member.full_name},\n\nYour loan interest balance has been updated.\n\nLoan Number: ${loan.loan_number || "—"}\nPrincipal: ${moneyNow(loan.principal || 0)}\nInterest Payable: ${moneyNow(loan.interest_payable || 0)}\nOutstanding Balance: ${moneyNow(loan.balance || 0)}\nInterest Rate: ${loan.interest_rate || 0}%\n\nPlease log in to the member portal to view your full repayment schedule.\n\nThank you,\nVeritas Team`,
        });
        sent++;
      } catch { failed++; }
    }
    setNotifResult({ type: sent > 0 ? "success" : "error", message: `${sent} interest notification(s) sent${failed > 0 ? `, ${failed} failed` : ""}.` });
    setSending(false);
  };

  const handleExportReport = () => {
    if (!data) return;
    const loanRows = data.loans.map((l) => ({
      Loan_Number: l.loan_number || "", Member: l.member_name || "",
      Shares_Balance: data.shares.find((sh) => sh.member_id === l.member_id)?.balance || 0,
      Principal: l.principal || 0, Interest_Rate: l.interest_rate || 0,
      Term_Months: l.term_months || 0, Outstanding_Balance: l.balance || 0,
      Interest_Payable: l.interest_payable || 0, Monthly_Installment: l.installment_amount || 0,
      Status: l.status || "", Disbursement_Date: l.disbursement_date || "",
    }));
    exportToCSV(loanRows, "loan-status-report.csv", ["Loan_Number","Member","Shares_Balance","Principal","Interest_Rate","Term_Months","Outstanding_Balance","Interest_Payable","Monthly_Installment","Status","Disbursement_Date"]);
    setTimeout(() => {
      const repaymentRows = data.repayments.map((r) => ({
        Loan_Number: r.loan_number || "", Member: r.member_name || "",
        Installment_Number: r.installment_number || 0, Amount: r.amount || 0,
        Due_Date: r.due_date || "", Status: r.status || "", Payment_Date: r.payment_date || "",
      }));
      exportToCSV(repaymentRows, "repayment-report.csv", ["Loan_Number","Member","Installment_Number","Amount","Due_Date","Status","Payment_Date"]);
    }, 600);
  };

  const handleExportCashIn = () => {
    if (!data) return;
    const rows = [];
    data.memberPayments.filter((p) => p.status === "approved").forEach((p) =>
      rows.push({ Type: p.payment_type || "member payment", Member: p.member_name || "", Number: p.member_number || "", Reference: p.payment_ref || "", Date: p.payment_date || "", Amount: p.amount || 0 })
    );
    data.loanPayments.filter((p) => p.status === "approved").forEach((p) =>
      rows.push({ Type: "loan repayment", Member: p.member_name || "", Number: p.member_number || "", Reference: p.payment_ref || "", Date: p.payment_date || "", Amount: p.amount || 0 })
    );
    exportToCSV(rows, "cash-in-summary.csv", ["Type", "Member", "Number", "Reference", "Date", "Amount"]);
  };

  const handleExportCashOut = () => {
    if (!data) return;
    const rows = [];
    data.loans.filter((l) => l.disbursement_date || l.status !== "pending").forEach((l) =>
      rows.push({ Type: "loan disbursement", Member: l.member_name || "", Account: l.loan_number || "", Reference: "", Date: l.disbursement_date || "", Amount: l.principal || 0 })
    );
    (data.journal || []).filter((j) => j.account_category === "expenses").forEach((j) =>
      rows.push({ Type: "expense", Member: "", Account: j.account_name || "", Reference: j.reference || "", Date: j.date || "", Amount: Math.max(0, (j.debit || 0) - (j.credit || 0)) })
    );
    (data.shareTx || []).filter((t) => t.type === "redemption" && (t.status === "completed" || t.status === "approved")).forEach((t) =>
      rows.push({ Type: "share redemption", Member: t.from_member_name || "", Account: "", Reference: t.reference || "", Date: t.date || "", Amount: t.amount || 0 })
    );
    exportToCSV(rows, "cash-out-summary.csv", ["Type", "Member", "Account", "Reference", "Date", "Amount"]);
  };

  const handleExportBankSummary = () => {
    if (!data) return;
    exportBankSummaryExcel({ institution, data, symbol, depositMode });
  };

  const toggleBalanceVisibility = async () => {
    const next = !showBalance;
    try {
      if (instSetting?.id) {
        const updated = await backend.entities.InstitutionSetting.update(instSetting.id, { show_bank_balance: next });
        setInstSetting(updated);
      } else if (institution?.id) {
        const created = await backend.entities.InstitutionSetting.create({ institution_id: institution.id, show_bank_balance: next });
        setInstSetting(created);
      }
      setShowBalance(next);
      toast({
        title: next ? "Bank balances shown" : "Bank balances hidden",
        description: next
          ? "Institutional balances are visible across the admin console."
          : "Institutional balances are masked across the admin console.",
      });
    } catch {
      toast({ title: "Could not update balance visibility", variant: "destructive" });
    }
  };

  const openModeDialog = (nextMode) => {
    if (nextMode === depositMode || savingMode) return;
    setPendingMode(nextMode);
    setModeDialogOpen(true);
  };

  const cancelModeChange = () => {
    setModeDialogOpen(false);
    setPendingMode(null);
  };

  const confirmModeChange = async () => {
    const nextMode = pendingMode;
    setModeDialogOpen(false);
    setPendingMode(null);
    if (!nextMode) return;
    setSavingMode(true);
    try {
      if (instSetting?.id) {
        const updated = await backend.entities.InstitutionSetting.update(instSetting.id, { deposit_mode: nextMode });
        setInstSetting(updated);
      } else if (institution?.id) {
        const created = await backend.entities.InstitutionSetting.create({ institution_id: institution.id, deposit_mode: nextMode });
        setInstSetting(created);
      }
      toast({
        title: nextMode === "auto" ? "Auto-deposit enabled" : "Manual deposit enabled",
        description: nextMode === "auto"
          ? "Monthly principal + interest will be added to the bank balance automatically."
          : "Physically deposit principal + interest repayments, registration fees and other income to the bank balance.",
      });
      load();
    } catch {
      toast({ title: "Could not update deposit mode", variant: "destructive" });
    }
    setSavingMode(false);
  };

  const intFmt = (v) => Math.round(v).toLocaleString();
  const cards = [
    { label: "Total Members", raw: data?.stats.totalMembers ?? 0, fmt: intFmt, icon: Users, color: "from-amber-500 to-yellow-600", link: "/members" },
    { label: "Outstanding Loans", raw: data?.stats.outstandingLoans ?? 0, fmt: money, icon: Wallet, color: "from-amber-600 to-orange-700", link: "/loans" },
    { label: "Total Share Balances", raw: data?.stats.totalShares ?? 0, fmt: money, icon: TrendingUp, color: "from-yellow-600 to-amber-700", link: "/shares" },
    { label: "Recent Interest Income", raw: data?.recentInterestIncome ?? 0, fmt: money, icon: Percent, color: "from-amber-700 to-yellow-800", link: "/payments" },
    { label: "Active Loans", raw: data?.stats.activeLoans ?? 0, fmt: intFmt, icon: Banknote, color: "from-amber-500 to-amber-700", link: "/loans" },
    { label: "Pending Payments", raw: data?.stats.pendingPayments ?? 0, fmt: intFmt, icon: AlertCircle, color: "from-rose-600 to-rose-800", link: "/payments" },
  ];

  const loanStatusData = data
    ? [
        { name: "Active", value: data.loans.filter((l) => l.status === "active").length },
        { name: "Pending", value: data.loans.filter((l) => l.status === "pending").length },
        { name: "Paid", value: data.loans.filter((l) => l.status === "paid").length },
        { name: "Defaulted", value: data.loans.filter((l) => l.status === "defaulted").length },
      ].filter((d) => d.value > 0)
    : [];

  const portfolioData = data
    ? [
        { name: "Shares", amount: data.stats.totalShares },
        { name: "Loans Out", amount: data.stats.outstandingLoans },
        { name: "Interest", amount: data.stats.totalInterest },
      ]
    : [];

  const pieColors = ["hsl(35 72% 45%)", "hsl(22 80% 55%)", "hsl(15 75% 50%)", "hsl(28 60% 35%)"];

  // Build last 6 months of data for charts
  const buildMonthlyData = () => {
    if (!data) return [];
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const nextKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

      // Loan balance: loans disbursed on or before this month-end
      const monthEnd = `${monthKey}-31`;
      const loansActive = data.loans.filter((l) =>
        l.status === "active" && l.disbursement_date && l.disbursement_date <= monthEnd
      );
      const loanBalance = loansActive.reduce((s, l) => s + (l.balance || 0), 0);

      // Interest income: approved loan payments in this month
      const monthPayments = data.loanPayments.filter(
        (p) => p.status === "approved" && p.payment_date && p.payment_date >= monthKey && p.payment_date < nextKey
      );
      const interestIncome = monthPayments.reduce((s, p) => {
        const loan = data.loans.find((l) => l.id === p.loan_id);
        if (!loan || !loan.principal) return s;
        const ratio = (loan.interest_payable || 0) / (loan.principal + (loan.interest_payable || 0));
        return s + (p.amount || 0) * ratio;
      }, 0);

      // Share growth: cumulative share contributions up to end of this month
      const shareGrowth = data.memberPayments
        .filter((p) => p.payment_type === "shares" && p.status === "approved" && p.payment_date && p.payment_date <= monthEnd)
        .reduce((s, p) => s + (p.amount || 0), 0);

      months.push({
        month: monthLabel,
        loanBalance,
        interestIncome: Math.round(interestIncome),
        shareGrowth,
      });
    }
    return months;
  };

  const monthlyData = buildMonthlyData();

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin Dashboard</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </span>
          </div>
          {institution && (
            <h1 className="shiny-green font-heading font-black tracking-tight leading-none mt-1" style={{ fontSize: "2.75rem", textTransform: "uppercase", filter: "drop-shadow(0 0 14px hsl(140 85% 50% / 0.5))" }}>
              {institution.name}
            </h1>
          )}
          <p className="text-muted-foreground mt-1">Overview of your cooperative's financial position</p>
        </div>
        {!loading && data && (
          <Button variant="outline" onClick={handleExportReport} className="gold-border">
            <Download className="w-4 h-4 mr-2" /> Export Report
          </Button>
        )}
      </div>

      {/* Bank Balance */}
      {!loading && data && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-600 shadow-lg shadow-emerald-900/40 overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-emerald-50/90 text-sm font-medium uppercase tracking-wide">Institution Bank Balance</p>
                <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
                  {showBalance ? <AnimatedCounter value={data.bankBalance ?? 0} format={money} /> : MASKED_BALANCE}
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-white">
              <button onClick={handleExportCashIn} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-2 text-left" title="Download cash-in summary">
                <Download className="w-4 h-4 flex-shrink-0" />
                <span>
                  <span className="block text-xs text-emerald-50/80">Cash In (receipts)</span>
                  <span className="block text-lg font-semibold">+{money(data.cashInflows ?? 0)}</span>
                </span>
              </button>
              <button onClick={handleExportCashOut} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-2 text-left" title="Download cash-out summary">
                <Download className="w-4 h-4 flex-shrink-0" />
                <span>
                  <span className="block text-xs text-emerald-50/80">Cash Out (loans/expenses)</span>
                  <span className="block text-lg font-semibold">-{money(data.cashOutflows ?? 0)}</span>
                </span>
              </button>
            </div>
          </div>
          <div className="px-6 pb-5 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-emerald-50/80 uppercase tracking-wide">Bank Deposit Mode</span>
              <button
                onClick={() => openModeDialog("auto")}
                disabled={savingMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  depositMode === "auto"
                    ? "bg-amber-400 text-black shadow"
                    : "bg-white/10 text-amber-50 hover:bg-white/20"
                }`}
                title="Automatically add monthly principal + interest collected to the bank balance"
              >
                Auto-add (monthly P + I)
              </button>
              <button
                onClick={() => openModeDialog("manual")}
                disabled={savingMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  depositMode === "manual"
                    ? "bg-amber-900 text-amber-50 shadow"
                    : "bg-white/10 text-amber-50 hover:bg-white/20"
                }`}
                title="Physically deposit principal + interest repayments, registration fees and other income to the bank balance"
              >
                Physical Deposit
              </button>
              <span className="w-px h-5 bg-white/20" />
              <button
                onClick={toggleBalanceVisibility}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-amber-50 hover:bg-white/20 transition-colors inline-flex items-center gap-1.5"
                title={showBalance ? "Hide institutional bank balances across the admin console" : "Show institutional bank balances across the admin console"}
              >
                {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showBalance ? "Hide Balance" : "Show Balance"}
              </button>
            </div>
            <Button variant="outline" onClick={handleExportBankSummary} className="bg-white/15 border-white/25 text-white hover:bg-white/25 hover:text-white">
              <Download className="w-4 h-4 mr-2" /> Download Summary
            </Button>
          </div>
        </div>
      )}

      {/* Physical Deposit to Bank (manual mode) */}
      {!loading && data && <PhysicalDepositPanel mode={depositMode} />}

      {/* Broadcast messages to members */}
      {!loading && institution && <BroadcastMessagesPanel institution={institution} />}

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-card rounded-2xl border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} to={card.link} className="group bg-card rounded-2xl border border-border p-5 hover:shadow-lg hover:shadow-amber-900/10 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">
                  <AnimatedCounter value={card.raw} format={card.fmt} />
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{card.label}</p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Charts row */}
      {!loading && data && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Financial Portfolio</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={portfolioData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43 15% 20%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(40 15% 55%)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(40 15% 55%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbolNow()}${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => moneyNow(v)} contentStyle={{ backgroundColor: "hsl(25 35% 12%)", border: "none", borderRadius: "0.5rem", color: "hsl(36 30% 88%)" }} />
                <Bar dataKey="amount" fill="hsl(35 72% 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Loans by Status</h3>
            {loanStatusData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={loanStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {loanStatusData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(25 35% 12%)", border: "none", borderRadius: "0.5rem", color: "hsl(36 30% 88%)" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {loanStatusData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly performance charts */}
      {!loading && data && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Loan Balance — Bar Chart */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-foreground">Monthly Loan Balances</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43 15% 20%)" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(40 15% 55%)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(40 15% 55%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbolNow()}${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => moneyNow(v)} contentStyle={{ backgroundColor: "hsl(25 35% 12%)", border: "none", borderRadius: "0.5rem", color: "hsl(36 30% 88%)" }} />
                <Bar dataKey="loanBalance" name="Loan Balance" fill="hsl(35 72% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Interest Income & Share Growth — Line Chart */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Interest Income &amp; Share Growth</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43 15% 20%)" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(40 15% 55%)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(40 15% 55%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbolNow()}${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => moneyNow(v)} contentStyle={{ backgroundColor: "hsl(25 35% 12%)", border: "none", borderRadius: "0.5rem", color: "hsl(36 30% 88%)" }} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(40 15% 55%)" }} />
                <Line type="monotone" dataKey="interestIncome" name="Interest Income" stroke="hsl(35 72% 50%)" strokeWidth={2} dot={{ fill: "hsl(35 72% 50%)", r: 3 }} />
                <Line type="monotone" dataKey="shareGrowth" name="Share Growth" stroke="hsl(140 60% 50%)" strokeWidth={2} dot={{ fill: "hsl(140 60% 50%)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Notifications panel */}
      {!loading && data && (
        <div className="mt-6 bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Email Notifications</h3>
            </div>
          </div>
          {notifResult && (
            <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${notifResult.type === "success" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/50" : "bg-rose-950/50 text-rose-400 border border-rose-800/50"}`}>
              {notifResult.message}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/repayments" className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all">
              <div className="w-10 h-10 rounded-lg bg-amber-950/50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Repayment Reminders</p>
                <p className="text-xs text-muted-foreground">Send due date alerts</p>
              </div>
            </Link>
            <button onClick={sendInterestNotifications} disabled={sending}
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left disabled:opacity-50">
              <div className="w-10 h-10 rounded-lg bg-rose-950/50 flex items-center justify-center">
                <Percent className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{sending ? "Sending..." : "Interest Updates"}</p>
                <p className="text-xs text-muted-foreground">Notify members of interest changes</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Quick actions + pending items */}
      {!loading && data && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Pending Applications</h3>
              </div>
              <Link to="/applications" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </div>
            {data.pendingApps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending applications</p>
            ) : (
              <div className="space-y-2">
                {data.pendingApps.slice(0, 4).map((a) => (
                  <Link key={a.id} to="/applications" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.member_name}</p>
                      <p className="text-xs text-muted-foreground">{a.member_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{money(a.requested_amount || 0)}</p>
                      <p className="text-xs text-amber-600">{a.requested_term_months || "—"} months</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Upcoming Repayments</h3>
              </div>
              <Link to="/repayments" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </div>
            {data.upcomingRepayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming repayments</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingRepayments.map((r) => (
                  <Link key={r.id} to="/repayments" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.member_name}</p>
                      <p className="text-xs text-muted-foreground">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{money(r.amount || 0)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick links */}
      {!loading && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Link to="/upload-loans" className="sunset-card-gradient rounded-2xl p-6 text-white hover:shadow-xl hover:shadow-amber-900/20 transition-all">
            <Banknote className="w-7 h-7 mb-3" />
            <h3 className="font-semibold text-lg">Upload Loans</h3>
            <p className="text-white/80 text-sm mt-1">Import member loan data in bulk</p>
          </Link>
          <Link to="/members" className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:shadow-amber-900/10 transition-all">
            <Users className="w-7 h-7 mb-3 text-amber-500" />
            <h3 className="font-semibold text-lg text-foreground">Manage Members</h3>
            <p className="text-muted-foreground text-sm mt-1">Add and track member records</p>
          </Link>
          <Link to="/accounting" className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:shadow-amber-900/10 transition-all">
            <PiggyBank className="w-7 h-7 mb-3 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">Accounting</h3>
            <p className="text-muted-foreground text-sm mt-1">Chart of accounts & financials</p>
          </Link>
        </div>
      )}
      <Dialog open={modeDialogOpen} onOpenChange={(o) => { if (!o) cancelModeChange(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Bank Deposit Mode</DialogTitle>
            <DialogDescription>
              {pendingMode === "auto"
                ? "Monthly principal + interest collected will be added to the bank balance automatically."
                : "You will physically deposit principal + interest repayments, registration fees and other income to the bank balance."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={cancelModeChange}>Cancel</Button>
            <Button
              onClick={confirmModeChange}
              disabled={savingMode}
              className={pendingMode === "auto" ? "bg-amber-400 text-black hover:bg-amber-500" : "bg-amber-900 text-amber-50 hover:bg-amber-900/90"}
            >
              {savingMode ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}