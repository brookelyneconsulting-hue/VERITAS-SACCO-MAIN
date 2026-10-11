// Auto-deduction of due loan installments (client-side, runs on dashboard load).
// For every installment whose due_date has arrived and is still pending, the
// principal + interest are recovered: an APPROVED loan payment is created (which
// feeds the dashboard bank balance), the installment is marked paid, and the
// loan's outstanding balance is reduced. Idempotent — skips installments that
// already have an approved payment.

export async function processDueDeductions(backend, { repayments, loanPayments }) {
  const today = new Date().toISOString().slice(0, 10);
  const due = repayments.filter(
    (r) => r.status === "pending" && r.due_date && r.due_date <= today
  );

  const existingIds = new Set(
    loanPayments
      .filter((p) => p.status === "approved" && p.repayment_id)
      .map((p) => p.repayment_id)
  );

  const created = [];
  for (const r of due) {
    if (existingIds.has(r.id)) {
      // already collected — just ensure the installment is marked paid
      await backend.entities.Repayment.update(r.id, {
        status: "paid",
        payment_date: today,
      }).catch(() => {});
      continue;
    }

    try {
      await backend.entities.LoanPayment.create({
        institution_id: r.institution_id || "",
        member_id: r.member_id,
        member_name: r.member_name,
        member_number: r.member_number,
        loan_id: r.loan_id,
        loan_number: r.loan_number,
        amount: r.amount,
        payment_ref: `AUTO-DEDUCT-${r.loan_number || r.loan_id || "LN"}-${r.installment_number || 0}`,
        payment_date: today,
        status: "approved",
        repayment_id: r.id,
      });

      await backend.entities.Repayment.update(r.id, {
        status: "paid",
        payment_date: today,
      });

      if (r.loan_id) {
        try {
          const loan = await backend.entities.Loan.get(r.loan_id);
          const newBalance = Math.max(0, (loan.balance || 0) - (r.principal_amount || 0));
          const newInterestPayable = Math.max(
            0,
            (loan.interest_payable || 0) - (r.interest_amount || 0)
          );
          const upd = { balance: newBalance, interest_payable: newInterestPayable };
          if (newBalance <= 0) upd.status = "paid";
          await backend.entities.Loan.update(r.loan_id, upd);
        } catch {
          // loan lookup failure should not abort the deduction
        }
      }

      existingIds.add(r.id);
      created.push(r);
    } catch {
      // skip this installment on error; will retry next load
    }
  }

  return created;
}