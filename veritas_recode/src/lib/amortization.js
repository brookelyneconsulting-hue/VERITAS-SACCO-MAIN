// Reducing-balance amortization schedule.
// Interest is charged each month on the outstanding (reducing) balance,
// so the principal portion grows and the interest portion shrinks over time.

export function monthlyInstallment(principal, annualRatePct, termMonths) {
  const p = Number(principal) || 0;
  const n = Math.max(0, Math.floor(Number(termMonths) || 0));
  if (n <= 0) return 0;
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  if (r === 0) return p / n;
  return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function buildAmortizationSchedule({
  principal,
  interest_rate,
  term_months,
  start_date,
}) {
  const p = Number(principal) || 0;
  const term = Math.max(0, Math.floor(Number(term_months) || 0));
  if (term <= 0) return [];

  const r = (Number(interest_rate) || 0) / 100 / 12;
  const payment = monthlyInstallment(p, Number(interest_rate) || 0, term);
  const base = start_date ? new Date(start_date) : new Date();

  let balance = p;
  const rows = [];
  for (let i = 1; i <= term; i++) {
    const interest = balance * r;
    let principalPortion = payment - interest;
    // On the final installment, settle whatever balance remains.
    if (i === term) principalPortion = balance;
    balance = Math.max(0, balance - principalPortion);
    const due = new Date(base);
    due.setMonth(due.getMonth() + i);
    rows.push({
      installment: i,
      due_date: due.toISOString().slice(0, 10),
      payment,
      interest,
      principal: principalPortion,
      balance,
    });
  }
  return rows;
}

export function totalInterest(schedule) {
  return (schedule || []).reduce((s, r) => s + (r.interest || 0), 0);
}

export function totalPayment(schedule) {
  return (schedule || []).reduce((s, r) => s + (r.payment || 0), 0);
}