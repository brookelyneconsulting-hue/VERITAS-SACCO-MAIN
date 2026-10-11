import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { computeAccountBalances } from "@/lib/accountBalances";

const severityStyles = {
  error: { icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
};

export default function AIValidationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [je, coa, loans, shares, st] = await Promise.all([
        backend.entities.JournalEntry.list("-date"),
        backend.entities.ChartOfAccount.list(),
        backend.entities.Loan.list().then(scoped),
        backend.entities.Share.list().then(scoped),
        backend.entities.ShareTransaction.list("-date"),
      ]);
      const accountBalances = computeAccountBalances(coa, je);
      const accounts = Object.values(accountBalances)
        .filter((a) => Math.abs(a.net) > 0.5)
        .map((a) => ({
          name: a.name,
          category: a.category,
          debit: Math.round(a.debit),
          credit: Math.round(a.credit),
          net: Math.round(a.net),
        }));
      const totalDebits = accounts.reduce(
        (s, a) => s + (a.category === "assets" || a.category === "expenses" ? Math.max(0, a.net) : 0),
        0
      );
      const totalCredits = accounts.reduce(
        (s, a) => s + (a.category !== "assets" && a.category !== "expenses" ? Math.max(0, a.net) : 0),
        0
      );
      const activeLoans = loans.filter((l) => l.status === "active");
      setData({
        accounts,
        totalDebits,
        totalCredits,
        balanced: Math.abs(totalDebits - totalCredits) < 1,
        loansReceivable: activeLoans.reduce((s, l) => s + (l.balance || 0), 0),
        loanInterestIncome: activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0),
        totalShares: shares.reduce((s, sh) => s + (sh.balance || 0), 0),
        asOf: new Date().toISOString().slice(0, 10),
        journalCount: je.length,
        coaCount: coa.length,
      });
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    if (!data) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const payload = {
        trial_balance: data.accounts,
        totals: {
          total_debits: data.totalDebits,
          total_credits: data.totalCredits,
          balanced: data.balanced,
        },
        key_figures: {
          loans_receivable: data.loansReceivable,
          loan_interest_income: data.loanInterestIncome,
          total_shares: data.totalShares,
        },
        meta: {
          as_of: data.asOf,
          journal_entries: data.journalCount,
          chart_accounts: data.coaCount,
        },
      };
      const res = await backend.integrations.Core.InvokeLLM({
        prompt:
          "You are an expert financial auditor for a savings and credit cooperative (SACCO). " +
          "Analyze the trial balance, totals, and key figures below. Determine whether the books balance, " +
          "identify anomalies, missing or misclassified accounts, unusual balances, and any accounting principle " +
          "violations (double-entry, matching). Return structured findings with severity (info/warning/error), " +
          "the area affected, the issue, and a concrete recommendation. Be concise and specific.\n\n" +
          "DATA:\n" +
          JSON.stringify(payload, null, 2),
        response_json_schema: {
          type: "object",
          properties: {
            overall_assessment: { type: "string" },
            is_balanced: { type: "boolean" },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["info", "warning", "error"] },
                  area: { type: "string" },
                  issue: { type: "string" },
                  recommendation: { type: "string" },
                },
                required: ["severity", "area", "issue", "recommendation"],
              },
            },
            summary: { type: "string" },
          },
          required: ["overall_assessment", "is_balanced", "findings", "summary"],
        },
      });
      setResult(res);
    } catch (e) {
      setError(e.message || "AI validation failed. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading accounting data...</div>;
  }

  const findings = (result?.findings || []).map((f) => ({
    ...f,
    style: severityStyles[(f.severity || "info").toLowerCase()] || severityStyles.info,
  }));

  return (
    <div className="space-y-6">
      <div className="luxury-card rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Accounting Validation</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analyze your trial balance and key figures for anomalies, misclassifications, and accounting principle violations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-muted/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Total Debits</p>
            <p className="text-lg font-bold text-foreground">${Math.round(data.totalDebits).toLocaleString()}</p>
          </div>
          <div className="bg-muted/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Total Credits</p>
            <p className="text-lg font-bold text-foreground">${Math.round(data.totalCredits).toLocaleString()}</p>
          </div>
          <div className="bg-muted/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Active Accounts</p>
            <p className="text-lg font-bold text-foreground">{data.accounts.length}</p>
          </div>
          <div className="bg-muted/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Trial Balance</p>
            <p className={`text-lg font-bold ${data.balanced ? "text-emerald-500" : "text-rose-500"}`}>
              {data.balanced ? "Balanced" : "Out of balance"}
            </p>
          </div>
        </div>

        <Button onClick={runValidation} disabled={running} className="gold-gradient text-primary-foreground">
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {running ? "Validating..." : "Run AI Validation"}
        </Button>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-4">{error}</p>
        )}
      </div>

      {result && (
        <div className="luxury-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            {result.is_balanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
            <h4 className="font-semibold text-foreground">Validation Results</h4>
            <span
              className={`ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full ${
                result.is_balanced
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-amber-500/15 text-amber-500"
              }`}
            >
              {result.is_balanced ? "Balanced" : "Issues Found"}
            </span>
          </div>

          <p className="text-sm text-foreground leading-relaxed">{result.overall_assessment}</p>

          {findings.length > 0 && (
            <div className="space-y-3">
              {findings.map((f, i) => {
                const Icon = f.style.icon;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${f.style.bg} ${f.style.border}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`w-4 h-4 ${f.style.color}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wide ${f.style.color}`}>
                        {f.severity}
                      </span>
                      <span className="text-sm font-medium text-foreground">{f.area}</span>
                    </div>
                    <p className="text-sm text-foreground mb-1.5">{f.issue}</p>
                    <p className="text-sm text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5 text-primary" />
                      {f.recommendation}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {result.summary && (
            <div className="bg-muted/20 rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
              <p className="text-sm text-foreground">{result.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}