// Builds a detailed, printable, Excel-compatible (.xls) bank balance summary.
// Excel opens the HTML table saved with a .xls extension; the embedded
// @media print stylesheet makes it print cleanly.

export function exportBankSummaryExcel({ institution, data, symbol, depositMode }) {
  const cur = (symbol || "").trim();
  const fmt = (v) =>
    Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const today = new Date().toLocaleString();
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Cash In — every approved receipt
  const cashInRows = [];
  (data.memberPayments || [])
    .filter((p) => p.status === "approved")
    .forEach((p) =>
      cashInRows.push({
        date: p.payment_date || "",
        type: p.payment_type === "subscription" ? "Registration Fee" : "Share Contribution",
        member: p.member_name || "",
        number: p.member_number || "",
        ref: p.payment_ref || "",
        amount: p.amount || 0,
      })
    );
  (data.loanPayments || [])
    .filter((p) => p.status === "approved")
    .forEach((p) =>
      cashInRows.push({
        date: p.payment_date || "",
        type: "Loan Repayment (P + I)",
        member: p.member_name || "",
        number: p.member_number || "",
        ref: p.payment_ref || "",
        amount: p.amount || 0,
      })
    );
  const cashInTotal = cashInRows.reduce((s, r) => s + (r.amount || 0), 0);

  // Cash Out — disbursed loans, expenses, share redemptions
  const cashOutRows = [];
  (data.loans || [])
    .filter((l) => l.disbursement_date || l.status !== "pending")
    .forEach((l) =>
      cashOutRows.push({
        date: l.disbursement_date || "",
        type: "Loan Disbursement",
        party: l.member_name || "",
        ref: l.loan_number || "",
        amount: l.principal || 0,
      })
    );
  (data.journal || [])
    .filter((j) => j.account_category === "expenses")
    .forEach((j) =>
      cashOutRows.push({
        date: j.date || "",
        type: "Expense",
        party: j.account_name || "",
        ref: j.reference || "",
        amount: Math.max(0, (j.debit || 0) - (j.credit || 0)),
      })
    );
  (data.shareTx || [])
    .filter((t) => t.type === "redemption" && (t.status === "completed" || t.status === "approved"))
    .forEach((t) =>
      cashOutRows.push({
        date: t.date || "",
        type: "Share Redemption",
        party: t.from_member_name || "",
        ref: t.reference || "",
        amount: t.amount || 0,
      })
    );
  const cashOutTotal = cashOutRows.reduce((s, r) => s + (r.amount || 0), 0);
  const bankBalance = data.bankBalance ?? 0;

  const numCell = (v) => `<td class="num">${cur} ${fmt(v)}</td>`;
  const txtCell = (v) => `<td>${esc(v)}</td>`;

  const inBody = cashInRows
    .map(
      (r) =>
        `<tr>${txtCell(r.date)}${txtCell(r.type)}${txtCell(r.member)}${txtCell(r.number)}${txtCell(r.ref)}${numCell(r.amount)}</tr>`
    )
    .join("");
  const outBody = cashOutRows
    .map(
      (r) =>
        `<tr>${txtCell(r.date)}${txtCell(r.type)}${txtCell(r.party)}${txtCell(r.ref)}${numCell(r.amount)}</tr>`
    )
    .join("");

  const emptyIn = cashInRows.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:#888">No approved receipts</td></tr>` : "";
  const emptyOut = cashOutRows.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:#888">No disbursements</td></tr>` : "";

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Bank Balance Detailed Summary</title>
<style>
  @page { size: landscape; margin: 1.2cm; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 2px solid #b45309; padding-bottom: 4px; color: #7c2d12; }
  .meta { color: #555; font-size: 12px; margin: 0 0 14px; }
  table { border-collapse: collapse; }
  table.summary { margin-bottom: 14px; }
  table.summary td { padding: 8px 14px; border: 1px solid #ccc; font-size: 13px; }
  table.summary .lbl { background: #f5f5f5; font-weight: bold; }
  table.summary .balance { background: #065f46; color: #fff; font-weight: bold; font-size: 16px; }
  table.detail { width: 100%; font-size: 12px; }
  table.detail th { background: #b45309; color: #fff; padding: 7px 9px; border: 1px solid #b45309; text-align: left; }
  table.detail td { padding: 5px 9px; border: 1px solid #ddd; }
  table.detail tr:nth-child(even) { background: #faf7f2; }
  table.detail tfoot td { font-weight: bold; background: #f5f5f5; }
  .num { text-align: right; white-space: nowrap; }
  @media print { h2 { break-after: avoid; } table.detail { break-inside: auto; } }
</style></head>
<body>
  <h1>${esc(institution?.name || "Institution")} — Bank Balance Detailed Summary</h1>
  <div class="meta">Generated: ${esc(today)}${cur ? ` &nbsp;|&nbsp; Currency: ${esc(cur)}` : ""}</div>
  <table class="summary">
    <tr><td class="lbl">Institution Bank Balance</td><td class="balance">${cur} ${fmt(bankBalance)}</td></tr>
    <tr><td class="lbl">Total Cash In</td><td>${cur} ${fmt(cashInTotal)}</td></tr>
    <tr><td class="lbl">Total Cash Out</td><td>${cur} ${fmt(cashOutTotal)}</td></tr>
    <tr><td class="lbl">Deposit Mode</td><td>${depositMode === "manual" ? "Manual (Physical Deposit)" : "Auto (Monthly P + I)"}</td></tr>
  </table>

  <h2>Cash In — Detailed Receipts</h2>
  <table class="detail">
    <thead><tr><th>Date</th><th>Type</th><th>Member</th><th>Number</th><th>Reference</th><th class="num">Amount</th></tr></thead>
    <tbody>${emptyIn}${inBody}</tbody>
    <tfoot><tr><td colspan="5">Total Cash In</td><td class="num">${cur} ${fmt(cashInTotal)}</td></tr></tfoot>
  </table>

  <h2>Cash Out — Detailed Disbursements</h2>
  <table class="detail">
    <thead><tr><th>Date</th><th>Type</th><th>Party / Account</th><th>Reference</th><th class="num">Amount</th></tr></thead>
    <tbody>${emptyOut}${outBody}</tbody>
    <tfoot><tr><td colspan="4">Total Cash Out</td><td class="num">${cur} ${fmt(cashOutTotal)}</td></tr></tfoot>
  </table>
</body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bank-balance-detail-summary-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}