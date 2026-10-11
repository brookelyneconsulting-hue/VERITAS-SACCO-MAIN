import React, { useEffect, useState, useCallback } from "react";
import { backend } from "@/api/backendClient";
import { scoped, getMyInstitutionId } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import { Landmark } from "lucide-react";
import { useMoney } from "@/lib/useMoney";
import { fetchInstitutionBankBalance } from "@/lib/institutionBalance";
import { fetchBalancesVisible, MASKED_BALANCE } from "@/lib/bankBalanceVisibility";
import ReceiveCashForm from "@/components/banking/ReceiveCashForm";
import RecentReceiptsTable from "@/components/banking/RecentReceiptsTable";
import MemberAccountsPanel from "@/components/banking/MemberAccountsPanel";
import WithdrawCashForm from "@/components/banking/WithdrawCashForm";
import IssueLoanForm from "@/components/banking/IssueLoanForm";

export default function Banking() {
  const { money } = useMoney();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [shares, setShares] = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [balance, setBalance] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showBalance, setShowBalance] = useState(true);
  const [withdrawalFee, setWithdrawalFee] = useState(0);
  const [loanRates, setLoanRates] = useState({});

  const load = useCallback(async () => {
    try {
      const [m, l, s, lp, mp, dep, wd, bal, vis, acc, st] = await Promise.all([
        backend.entities.Member.list().then(scoped).catch(() => []),
        backend.entities.Loan.list().then(scoped).catch(() => []),
        backend.entities.Share.list().then(scoped).catch(() => []),
        backend.entities.LoanPayment.list("-payment_date").then(scoped).catch(() => []),
        backend.entities.MemberPayment.list("-payment_date").then(scoped).catch(() => []),
        backend.entities.BankDeposit.list("-deposit_date").then(scoped).catch(() => []),
        backend.entities.BankWithdrawal.list("-withdrawal_date").then(scoped).catch(() => []),
        fetchInstitutionBankBalance().catch(() => null),
        fetchBalancesVisible(),
        backend.entities.MemberAccount.list().then(scoped).catch(() => []),
        backend.entities.InstitutionSetting.list().catch(() => []),
      ]);
      setMembers(m);
      setLoans(l);
      setShares(s);
      setLoanPayments(lp);
      setMemberPayments(mp);
      setDeposits(dep);
      setWithdrawals(wd);
      setBalance(bal ? bal.bankBalance : null);
      setShowBalance(vis);
      setAccounts(acc);
      // Admin-configured counter withdrawal fee (Account Settings tab)
      const instId = await getMyInstitutionId();
      const setting = st.find((s) => s.institution_id === instId) || (instId === null ? st[0] : null);
      setWithdrawalFee(setting?.withdrawal_fee ?? 0);
      setLoanRates({
        rate_normal: setting?.rate_normal ?? 12,
        rate_advance: setting?.rate_advance ?? 18,
        rate_emergency: setting?.rate_emergency ?? 24,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Layout>
        <div className="p-10 text-center text-muted-foreground">Loading banking...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> Banking
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Receive physical cash for loans and shares — every receipt is cash in on the institutional balance.
          </p>
        </div>

        {/* Live institutional balance */}
        <div className="luxury-card rounded-2xl p-5 flex items-center gap-4">
          <Landmark className="w-8 h-8 text-sky-500" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Institutional Bank Balance (Live)</p>
            <p className="text-3xl font-bold text-sky-500">{balance === null ? "—" : showBalance ? money(balance) : MASKED_BALANCE}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cash received below increases this balance immediately.
            </p>
          </div>
        </div>

        <MemberAccountsPanel members={members} accounts={accounts} onChanged={load} />

        <ReceiveCashForm members={members} loans={loans} shares={shares} accounts={accounts} onReceived={load} />

        <WithdrawCashForm members={members} accounts={accounts} bankBalance={balance} withdrawalFee={withdrawalFee} onWithdrawn={load} />

        <IssueLoanForm members={members} shares={shares} accounts={accounts} bankBalance={balance} rates={loanRates} onIssued={load} />

        <RecentReceiptsTable
          loanPayments={loanPayments}
          memberPayments={memberPayments}
          otherReceipts={deposits.filter((d) => !d.payment_id)}
          withdrawals={withdrawals}
        />
      </div>
    </Layout>
  );
}