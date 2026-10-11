import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileDown } from "lucide-react";
import { buildAmortizationSchedule, totalInterest } from "@/lib/amortization";
import { exportToPDF } from "@/lib/pdfExport";
import { exportToCSV } from "@/lib/csvExport";
import { useMoney } from "@/lib/useMoney";

const COLS = ["Installment", "Due Date", "Payment", "Principal", "Interest", "Balance"];

// A theme-independent, printable schedule. Inline styles keep the captured
// PDF artifact white regardless of whether it's rendered on a light or dark page.
export default function AmortizationSchedule({ loan, institutionName, memberName }) {
  const ref = useRef(null);
  const { money } = useMoney();

  if (!loan || !loan.term_months) {
    return <p className="text-sm text-slate-400">No schedule available for this loan.</p>;
  }

  const rows = buildAmortizationSchedule({
    principal: loan.principal,
    interest_rate: loan.interest_rate,
    term_months: loan.term_months,
    interest_payable: loan.interest_payable,
    installment_amount: loan.installment_amount,
    start_date: loan.payment_due_date || loan.disbursement_date,
  });

  if (!rows.length) {
    return <p className="text-sm text-slate-400">No schedule available for this loan.</p>;
  }

  const totalPayment = rows.reduce((s, r) => s + r.payment, 0);
  const totalInt = totalInterest(rows);
  const monthlyPayment = rows.length ? rows[0].payment : 0;
  const fname = `amortization-${loan.loan_number || "schedule"}`;

  const handlePDF = async () => {
    await exportToPDF(ref.current, `${fname}.pdf`, "#ffffff");
  };

  const handleCSV = () => {
    exportToCSV(
      rows.map((r) => ({
        Installment: r.installment,
        "Due Date": r.due_date,
        Payment: r.payment.toFixed(2),
        Principal: r.principal.toFixed(2),
        Interest: r.interest.toFixed(2),
        Balance: r.balance.toFixed(2),
      })),
      `${fname}.csv`,
      COLS
    );
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" onClick={handlePDF}>
          <Download className="w-4 h-4 mr-1" /> Download PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handleCSV}>
          <FileDown className="w-4 h-4 mr-1" /> Download CSV
        </Button>
      </div>

      <div ref={ref} style={{ background: "#ffffff", color: "#0f172a" }} className="rounded-lg p-5">
        <div style={{ textAlign: "center", marginBottom: "14px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            {institutionName ? `${institutionName} — ` : ""}Loan Amortization Schedule
          </div>
          <div style={{ fontSize: "12px", color: "#475569" }}>
            {memberName ? `Member: ${memberName} · ` : ""}
            Loan #: {loan.loan_number || "—"} · Principal: {money(loan.principal || 0, 2)} ·
            Rate: {loan.interest_rate || 0}% · Term: {loan.term_months} months ·
            Installment: {money(monthlyPayment, 2)} · Total Interest: {money(totalInt, 2)}
          </div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
            Reducing-balance method · interest charged on the outstanding balance each month
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {COLS.map((c) => (
                <th
                  key={c}
                  style={{
                    padding: "6px 8px",
                    textAlign: c === "Installment" || c === "Due Date" ? "left" : "right",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.installment}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{r.installment}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{r.due_date}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{money(r.payment, 2)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{money(r.principal, 2)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{money(r.interest, 2)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{money(r.balance, 2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: "6px 8px", textAlign: "right" }}>Total</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{money(totalPayment, 2)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{money(totalInt, 2)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}