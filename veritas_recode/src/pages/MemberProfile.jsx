import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Banknote, TrendingUp, Percent } from "lucide-react";
import MemberTransactionHistory from "@/components/MemberTransactionHistory";
import { useMoney } from "@/lib/useMoney";

export default function MemberProfile() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [shares, setShares] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const { money } = useMoney();

  useEffect(() => {
    const load = async () => {
      try {
        const [m, s, l] = await Promise.all([
          backend.entities.Member.get(id),
          backend.entities.Share.filter({ member_id: id }),
          backend.entities.Loan.filter({ member_id: id }),
        ]);
        setMember(m);
        setShares(s);
        setLoans(l);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);
  const outstandingLoans = loans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + (l.balance || 0), 0);
  const totalInterest = loans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + (l.interest_payable || 0), 0);
  const totalBorrowed = loans.reduce((s, l) => s + (l.principal || 0), 0);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <Layout>
        <div className="p-10 text-center text-slate-400">Loading...</div>
      </Layout>
    );
  }

  if (!member) {
    return (
      <Layout>
        <div className="p-10 text-center">
          <p className="text-slate-500">Member not found.</p>
          <Link to="/members">
            <Button variant="link" className="mt-2">
              Back to Members
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* On-screen header (hidden when printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/members">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
              {member.full_name}
            </h1>
            <p className="text-slate-500 text-sm">
              Member #{member.member_number}
            </p>
          </div>
        </div>
        <Button
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Summary
        </Button>
      </div>

      {/* Printable document */}
      <div className="bg-white rounded-2xl border border-slate-200 print:border-0 p-6 lg:p-8 print:p-0 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center print:hidden">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">SaccoHub</h2>
              <p className="text-xs text-slate-400">Member Finance Summary</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Member info */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Member Information
          </h3>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
            <div>
              <span className="text-slate-400">Full Name</span>
              <p className="font-medium text-slate-900">{member.full_name}</p>
            </div>
            <div>
              <span className="text-slate-400">Member Number</span>
              <p className="font-medium text-slate-900">
                {member.member_number}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Email</span>
              <p className="font-medium text-slate-900">
                {member.email || "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Phone</span>
              <p className="font-medium text-slate-900">
                {member.phone || "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Joined Date</span>
              <p className="font-medium text-slate-900">
                {member.joined_date
                  ? new Date(member.joined_date).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Status</span>
              <p className="font-medium capitalize text-slate-900">
                {member.status}
              </p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-xs font-medium text-slate-500">
                Total Shares
              </span>
            </div>
            <p className="font-bold text-lg text-slate-900">
              {money(totalShares)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center gap-1.5 text-amber-600 mb-1">
              <Banknote className="w-3.5 h-3.5" />
              <span className="text-xs font-medium text-slate-500">
                Outstanding
              </span>
            </div>
            <p className="font-bold text-lg text-slate-900">
              {money(outstandingLoans)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center gap-1.5 text-rose-600 mb-1">
              <Percent className="w-3.5 h-3.5" />
              <span className="text-xs font-medium text-slate-500">
                Interest Payable
              </span>
            </div>
            <p className="font-bold text-lg text-slate-900">
              {money(totalInterest)}
            </p>
          </div>
        </div>

        {/* Shares table */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Share Balances
          </h3>
          {shares.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">
              No share records found.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-medium text-slate-500 py-2">
                    Contributions
                  </th>
                  <th className="text-left font-medium text-slate-500 py-2">
                    Last Date
                  </th>
                  <th className="text-right font-medium text-slate-500 py-2">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">
                      {s.contributions_count || 0}
                    </td>
                    <td className="py-2 text-slate-700">
                      {s.last_contribution_date
                        ? new Date(
                            s.last_contribution_date
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2 text-right font-semibold text-emerald-700">
                      {money(s.balance || 0)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={2} className="py-2 font-semibold text-slate-900">
                    Total Shares
                  </td>
                  <td className="py-2 text-right font-bold text-emerald-700">
                    {money(totalShares)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Loans table */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Loan Records
          </h3>
          {loans.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">No loan records found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-medium text-slate-500 py-2">
                    Loan #
                  </th>
                  <th className="text-right font-medium text-slate-500 py-2">
                    Principal
                  </th>
                  <th className="text-right font-medium text-slate-500 py-2">
                    Interest
                  </th>
                  <th className="text-right font-medium text-slate-500 py-2">
                    Installment
                  </th>
                  <th className="text-right font-medium text-slate-500 py-2">
                    Balance
                  </th>
                  <th className="text-left font-medium text-slate-500 py-2">
                    Due Date
                  </th>
                  <th className="text-left font-medium text-slate-500 py-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">
                      {l.loan_number || "—"}
                    </td>
                    <td className="py-2 text-right text-slate-700">
                      {money(l.principal || 0)}
                    </td>
                    <td className="py-2 text-right text-rose-600">
                      {money(l.interest_payable || 0)}
                    </td>
                    <td className="py-2 text-right text-slate-700">
                      {money(l.installment_amount || 0)}
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-900">
                      {money(l.balance || 0)}
                    </td>
                    <td className="py-2 text-slate-700">
                      {l.payment_due_date
                        ? new Date(l.payment_due_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2 capitalize text-slate-700">
                      {l.status}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200">
                  <td className="py-2 font-semibold text-slate-900">
                    Outstanding Total
                  </td>
                  <td colSpan={4}></td>
                  <td className="py-2 text-right font-bold text-slate-900">
                    {money(outstandingLoans)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Transaction History (not printable) */}
        <div className="print:hidden mt-2">
          <MemberTransactionHistory memberId={member.id} memberName={member.full_name} />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          <p>This summary was generated by SaccoHub — Member Finance Manager</p>
        </div>
      </div>
    </Layout>
  );
}