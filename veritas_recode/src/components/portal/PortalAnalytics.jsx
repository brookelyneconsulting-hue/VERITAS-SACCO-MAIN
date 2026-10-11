import React, { useMemo } from "react";
import { useMoney, moneyNow, symbolNow } from "@/lib/useMoney";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { BarChart3, TrendingUp, Wallet, PieChart as PieIcon } from "lucide-react";

const Empty = () => (
  <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">No data yet</div>
);

export default function PortalAnalytics({ shares, loans, payments, memberPayments }) {
  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);
  const activeLoans = loans.filter((l) => l.status === "active" || l.status === "pending");
  const outstandingBalance = activeLoans.reduce((s, l) => s + (l.balance || 0), 0);
  const totalInterest = activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0);

  // Cumulative share growth over the last 12 months (approved share payments)
  const shareGrowthData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const monthEnd = `${key}-31`;
      const cumulative = (memberPayments || [])
        .filter((p) => p.payment_type === "shares" && p.status === "approved" && p.payment_date && p.payment_date <= monthEnd)
        .reduce((s, p) => s + (p.amount || 0), 0);
      months.push({ month: label, shares: cumulative });
    }
    return months;
  }, [memberPayments]);

  // Loan repayment progress (paid vs balance per loan)
  const loanData = loans.slice(0, 6).map((l) => ({
    name: l.loan_number || "Loan",
    Paid: Math.max(0, (l.principal || 0) - (l.balance || 0)),
    Balance: l.balance || 0,
  }));

  // Portfolio breakdown donut
  const portfolioData = [
    { name: "Shares", value: totalShares },
    { name: "Loan Balance", value: outstandingBalance },
    { name: "Interest", value: totalInterest },
  ].filter((d) => d.value > 0);

  // Monthly payments over the last 6 months (loan + member payments)
  const monthlyPayments = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const next = `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const amt = [...(payments || []), ...(memberPayments || [])]
        .filter((p) => p.payment_date && p.payment_date >= key && p.payment_date < next)
        .reduce((s, p) => s + (p.amount || 0), 0);
      months.push({ month: label, amount: amt });
    }
    return months;
  }, [payments, memberPayments]);

  const colors = ["#f59e0b", "#10b981", "#f43f5e", "#3b82f6"];
  const tooltipStyle = {
    backgroundColor: "#0f172a", border: "1px solid #78350f",
    borderRadius: "0.5rem", color: "#fef3c7", fontSize: "12px",
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 p-5 mb-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-amber-100">My Financial Analytics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Share growth */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-amber-800/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-sm font-medium text-amber-100">Share Growth (12 months)</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={shareGrowthData}>
              <defs>
                <linearGradient id="shareGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbolNow()}${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => moneyNow(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="shares" name="Shares" stroke="#10b981" strokeWidth={2} fill="url(#shareGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Loan repayment progress */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-amber-800/10">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-100">Loan Repayment Progress</p>
          </div>
          {loanData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={loanData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbolNow()}${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => moneyNow(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
                <Bar dataKey="Paid" stackId="a" name="Paid" fill="#10b981" />
                <Bar dataKey="Balance" stackId="a" name="Balance" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Portfolio donut */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-amber-800/10">
          <div className="flex items-center gap-2 mb-3">
            <PieIcon className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-100">Portfolio Overview</p>
          </div>
          {portfolioData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={portfolioData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {portfolioData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => moneyNow(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly payments */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-amber-800/10">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-100">Monthly Payments</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyPayments}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbolNow()}${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => moneyNow(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="amount" name="Payments" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}