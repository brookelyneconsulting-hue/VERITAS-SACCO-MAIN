import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import Layout from "@/components/Layout";
import DateRangeFilter from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function LoanUpload() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [allLoans, setAllLoans] = useState([]);
  const [loanSearch, setLoanSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    backend.entities.Member.list().then((data) => scoped(data)).then((data) => {
      setMembers(data);
      setLoading(false);
    });
    backend.entities.Loan.list("-created_date").then((data) => scoped(data)).then((data) => setAllLoans(data));
  }, []);

  const filteredLoans = allLoans.filter((l) => {
    const matchSearch =
      l.member_name?.toLowerCase().includes(loanSearch.toLowerCase()) ||
      l.loan_number?.toLowerCase().includes(loanSearch.toLowerCase());
    const date = l.created_date?.slice(0, 10);
    const matchFrom = !fromDate || (date && date >= fromDate);
    const matchTo = !toDate || (date && date <= toDate);
    return matchSearch && matchFrom && matchTo;
  });

  const handleFile = async (selectedFile) => {
    setFile(selectedFile);
    setResult(null);
    if (!selectedFile) return;

    try {
      const { file_url } = await backend.integrations.Core.UploadFile({
        file: selectedFile,
      });
      const res = await backend.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            loans: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  member_number: { type: "string" },
                  loan_number: { type: "string" },
                  principal: { type: "number" },
                  interest_rate: { type: "number" },
                  term_months: { type: "number" },
                  balance: { type: "number" },
                  interest_payable: { type: "number" },
                  installment_amount: { type: "number" },
                  payment_due_date: { type: "string" },
                  status: { type: "string" },
                  disbursement_date: { type: "string" },
                },
              },
            },
          },
        },
      });
      setParsed(res.output?.loans || []);
    } catch (err) {
      setResult({
        type: "error",
        message: "Could not read the file. Please check the format.",
      });
    }
  };

  const handleUpload = async () => {
    if (parsed.length === 0) return;
    setUploading(true);
    let created = 0;
    let failed = 0;
    const records = [];

    for (const row of parsed) {
      const member = members.find(
        (m) => m.member_number === row.member_number
      );
      if (!member) {
        failed++;
        continue;
      }
      const principal = Number(row.principal) || 0;
      const rate = Number(row.interest_rate) || 0;
      const term = Number(row.term_months) || 0;
      const balance = Number(row.balance) || principal;
      const interest_payable = Number(row.interest_payable) || (principal * (rate / 100) * (term / 12));
      const installment_amount = Number(row.installment_amount) || (term > 0 ? (balance + interest_payable) / term : 0);
      records.push({
        institution_id: member.institution_id || (await institutionIdForCreate()),
        member_id: member.id,
        member_name: member.full_name,
        loan_number: row.loan_number || "",
        principal,
        interest_rate: rate,
        term_months: term,
        balance,
        interest_payable,
        installment_amount,
        payment_due_date: row.payment_due_date || "",
        status: row.status || "pending",
        disbursement_date: row.disbursement_date || "",
      });
    }

    try {
      if (records.length > 0) {
        await backend.entities.Loan.bulkCreate(records);
        created = records.length;
      }
      setResult({
        type: "success",
        message: `${created} loan(s) imported successfully${
          failed > 0 ? ` — ${failed} skipped (member not found)` : ""
        }.`,
      });
      setParsed([]);
      setFile(null);
    } catch (err) {
      setResult({
        type: "error",
        message: "Upload failed. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
          Upload Loans
        </h1>
        <p className="text-slate-500 mt-1">
          Import loan data in bulk from a CSV or Excel file
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8">
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 lg:p-12 text-center hover:border-emerald-400 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="font-medium text-slate-900 mb-1">
            Drop your loan file here, or browse
          </p>
          <p className="text-sm text-slate-400 mb-4">
            Supports CSV and Excel files
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={loading || uploading}
            />
            <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 cursor-pointer">
              Choose File
            </span>
          </label>
          {file && (
            <p className="text-sm text-slate-500 mt-3 flex items-center justify-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              {file.name}
            </p>
          )}
        </div>

        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-medium text-slate-600 mb-2">
            Expected columns:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "member_number",
              "loan_number",
              "principal",
              "interest_rate",
              "term_months",
              "balance",
              "interest_payable",
              "installment_amount",
              "payment_due_date",
              "status",
              "disbursement_date",
            ].map((col) => (
              <code
                key={col}
                className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-600"
              >
                {col}
              </code>
            ))}
          </div>
        </div>

        {parsed.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700">
                {parsed.length} loan(s) ready to import
              </p>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {uploading ? "Uploading..." : "Import Loans"}
              </Button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left font-medium text-slate-500 px-3 py-2">
                      Member #
                    </th>
                    <th className="text-left font-medium text-slate-500 px-3 py-2">
                      Loan #
                    </th>
                    <th className="text-right font-medium text-slate-500 px-3 py-2">
                      Principal
                    </th>
                    <th className="text-right font-medium text-slate-500 px-3 py-2">
                      Balance
                    </th>
                    <th className="text-right font-medium text-slate-500 px-3 py-2 hidden sm:table-cell">
                      Interest
                    </th>
                    <th className="text-left font-medium text-slate-500 px-3 py-2 hidden md:table-cell">
                      Due Date
                    </th>
                    <th className="text-left font-medium text-slate-500 px-3 py-2">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-3 py-2 text-slate-700">
                        {row.member_number}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.loan_number || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        ${Number(row.principal || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        ${Number(row.balance || row.principal || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-600 hidden sm:table-cell">
                        ${Number(row.interest_payable || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-slate-700 hidden md:table-cell">
                        {row.payment_due_date
                          ? new Date(row.payment_due_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 capitalize">
                        {row.status || "pending"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 8 && (
                <p className="text-xs text-slate-400 px-3 py-2">
                  +{parsed.length - 8} more rows...
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <div
            className={`mt-4 flex items-center gap-2 p-4 rounded-xl ${
              result.type === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {result.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{result.message}</span>
          </div>
        )}
      </div>

      {/* Previously Uploaded Loans */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Uploaded Loans
        </h2>
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by member or loan #..."
              value={loanSearch}
              onChange={(e) => setLoanSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onClear={() => { setFromDate(""); setToDate(""); }}
          />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {filteredLoans.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No loans found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left font-medium text-slate-500 px-5 py-3">Member</th>
                    <th className="text-left font-medium text-slate-500 px-5 py-3 hidden sm:table-cell">Loan #</th>
                    <th className="text-right font-medium text-slate-500 px-5 py-3">Principal</th>
                    <th className="text-right font-medium text-slate-500 px-5 py-3 hidden md:table-cell">Balance</th>
                    <th className="text-left font-medium text-slate-500 px-5 py-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.slice(0, 50).map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-900">{l.member_name}</td>
                      <td className="px-5 py-3 text-slate-600 hidden sm:table-cell">{l.loan_number || "—"}</td>
                      <td className="px-5 py-3 text-right text-slate-900">${(l.principal || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900 hidden md:table-cell">
                        ${(l.balance || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {l.created_date ? new Date(l.created_date).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}