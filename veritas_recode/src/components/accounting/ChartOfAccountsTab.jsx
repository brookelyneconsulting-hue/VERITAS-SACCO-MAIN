import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped, institutionIdForCreate } from "@/lib/institutionScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, BookOpen, Search, Pencil, Link2 } from "lucide-react";
import { CHART_OF_ACCOUNTS, getFlatAccounts } from "@/lib/chartOfAccounts";
import { computeInstitutionBankBalance, isBankAssetAccount } from "@/lib/institutionBalance";
import { useMoney } from "@/lib/useMoney";

export default function ChartOfAccountsTab() {
  const { money } = useMoney();
  const catalog = getFlatAccounts();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    account_name: "",
    account_code: "",
    account_category: "assets",
    account_subcategory: "",
    opening_balance: 0,
    opening_balance_type: "debit",
  });

  // Linked bank account: the "Bank Accounts" asset row stays in sync with the
  // institution's live bank balance (same source as the admin Dashboard), so
  // the accounting reports pick it up seamlessly.
  const [bankAccountId, setBankAccountId] = useState(null);

  const load = async () => {
    try {
      const [data, loans, loanPayments, memberPayments, journal, shareTx] = await Promise.all([
        backend.entities.ChartOfAccount.list("account_category"),
        backend.entities.Loan.list().then(scoped).catch(() => []),
        backend.entities.LoanPayment.list("-payment_date").then(scoped).catch(() => []),
        backend.entities.MemberPayment.list("-payment_date").then(scoped).catch(() => []),
        backend.entities.JournalEntry.list().catch(() => []),
        backend.entities.ShareTransaction.list().catch(() => []),
      ]);
      let nextAccounts = data;
      const { bankBalance } = computeInstitutionBankBalance({ loans, loanPayments, memberPayments, journal, shareTx });
      const bankAcc = data.find(isBankAssetAccount);
      if (bankAcc) {
        setBankAccountId(bankAcc.id);
        if (Math.abs((bankAcc.opening_balance || 0) - bankBalance) > 0.5) {
          await backend.entities.ChartOfAccount.update(bankAcc.id, { opening_balance: bankBalance });
          nextAccounts = data.map((a) => (a.id === bankAcc.id ? { ...a, opening_balance: bankBalance } : a));
        }
      }
      setAccounts(nextAccounts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubs = [];
    try { unsubs.push(backend.entities.LoanPayment.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.MemberPayment.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.Loan.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.JournalEntry.subscribe(() => load())); } catch {}
    try { unsubs.push(backend.entities.ShareTransaction.subscribe(() => load())); } catch {}
    return () => unsubs.forEach((u) => u && u());
  }, []);

  const categoryOptions = Object.entries(CHART_OF_ACCOUNTS).map(([key, cat]) => ({
    value: key,
    label: cat.label,
  }));

  const subcategoryOptions = form.account_category
    ? Object.keys(CHART_OF_ACCOUNTS[form.account_category]?.subcategories || {})
    : [];

  const presetAccounts = form.account_category
    ? CHART_OF_ACCOUNTS[form.account_category]?.subcategories?.[form.account_subcategory] || []
    : [];

  const handleSubmit = async () => {
    if (!form.account_name.trim()) return;
    const payload = {
      account_name: form.account_name.trim(),
      account_code: form.account_code.trim(),
      account_category: form.account_category,
      account_subcategory: form.account_subcategory,
      opening_balance: Number(form.opening_balance) || 0,
      opening_balance_type: form.opening_balance_type,
      status: "active",
    };
    if (editingId) {
      await backend.entities.ChartOfAccount.update(editingId, payload);
    } else {
      await backend.entities.ChartOfAccount.create({ ...payload, institution_id: await institutionIdForCreate() });
    }
    setOpen(false);
    setEditingId(null);
    setForm({ account_name: "", account_code: "", account_category: "assets", account_subcategory: "", opening_balance: 0, opening_balance_type: "debit" });
    load();
  };

  const handleQuickAdd = async (item) => {
    await backend.entities.ChartOfAccount.create({
      institution_id: await institutionIdForCreate(),
      account_name: item.name,
      account_code: "",
      account_category: item.category,
      account_subcategory: item.subcategory,
      opening_balance: 0,
      opening_balance_type: (item.category === "assets" || item.category === "expenses") ? "debit" : "credit",
      status: "active",
    });
    load();
  };

  const handleEdit = (acc) => {
    setEditingId(acc.id);
    setForm({
      account_name: acc.account_name,
      account_code: acc.account_code || "",
      account_category: acc.account_category,
      account_subcategory: acc.account_subcategory || "",
      opening_balance: acc.opening_balance || 0,
      opening_balance_type: acc.opening_balance_type || "debit",
    });
    setOpen(true);
  };

  const seedDefaults = async () => {
    const instId = await institutionIdForCreate();
    const existing = accounts.map((a) => `${a.account_category}|${a.account_name}`);
    const toCreate = [];
    let code = 1000;
    Object.entries(CHART_OF_ACCOUNTS).forEach(([catKey, cat]) => {
      Object.entries(cat.subcategories).forEach(([subKey, accNames]) => {
        accNames.forEach((name) => {
          const key = `${catKey}|${name}`;
          if (!existing.includes(key)) {
            toCreate.push({
              institution_id: instId,
              account_name: name,
              account_code: String(code++),
              account_category: catKey,
              account_subcategory: subKey,
              opening_balance: 0,
              opening_balance_type: (catKey === "assets" || catKey === "expenses") ? "debit" : "credit",
              is_system: true,
              status: "active",
            });
          }
        });
      });
    });
    if (toCreate.length > 0) {
      await backend.entities.ChartOfAccount.bulkCreate(toCreate);
      load();
    }
  };

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.account_name?.toLowerCase().includes(q) ||
      a.account_code?.toLowerCase().includes(q) ||
      a.account_category?.toLowerCase().includes(q) ||
      a.account_subcategory?.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce((acc, a) => {
    if (!acc[a.account_category]) acc[a.account_category] = [];
    acc[a.account_category].push(a);
    return acc;
  }, {});

  // Standard-catalog accounts matching the search that are not yet saved.
  const existingKeys = new Set(accounts.map((a) => `${a.account_category}|${a.account_name}`.toLowerCase()));
  const q = search.trim().toLowerCase();
  const catalogMatches = q
    ? catalog.filter((item) =>
        (item.name.toLowerCase().includes(q) ||
          item.categoryLabel.toLowerCase().includes(q) ||
          item.subcategory.toLowerCase().includes(q)) &&
        !existingKeys.has(`${item.category}|${item.name}`.toLowerCase())
      )
    : [];

  const totalDebits = accounts.reduce((s, a) => s + (a.opening_balance_type === "debit" ? a.opening_balance || 0 : 0), 0);
  const totalCredits = accounts.reduce((s, a) => s + (a.opening_balance_type === "credit" ? a.opening_balance || 0 : 0), 0);

  const categoryLabels = {
    assets: "Assets", liabilities: "Liabilities", equity: "Capital (Equity)", income: "Income", expenses: "Expenses",
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="font-semibold text-foreground">Chart of Accounts</h3>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedDefaults}>
              <BookOpen className="w-4 h-4 mr-1" /> Seed Default Accounts
            </Button>
          )}
          <Button onClick={() => { setEditingId(null); setForm({ account_name: "", account_code: "", account_category: "assets", account_subcategory: "", opening_balance: 0, opening_balance_type: "debit" }); setOpen(!open); }}>
            <Plus className="w-4 h-4 mr-2" /> New Account
          </Button>
        </div>
      </div>

      {/* Opening Balance Summary */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="luxury-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Debit Opening Balances</p>
            <p className="text-xl font-bold text-foreground">{money(totalDebits)}</p>
          </div>
          <div className="luxury-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Credit Opening Balances</p>
            <p className="text-xl font-bold text-foreground">{money(totalCredits)}</p>
          </div>
          <div className="luxury-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Balance Check</p>
            <p className={`text-xl font-bold ${Math.abs(totalDebits - totalCredits) < 1 ? "text-emerald-500" : "text-amber-500"}`}>
              {Math.abs(totalDebits - totalCredits) < 1 ? "✓ Balanced" : `${money(Math.round(Math.abs(totalDebits - totalCredits)))} diff`}
            </p>
          </div>
        </div>
      )}

      {/* New/Edit Account Form */}
      {open && (
        <div className="luxury-card rounded-2xl p-5 mb-6">
          <h4 className="font-semibold text-foreground mb-4">{editingId ? "Edit Account" : "New Account"}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={form.account_category} onValueChange={(v) => setForm({ ...form, account_category: v, account_subcategory: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcategory</Label>
              <Select value={form.account_subcategory} onValueChange={(v) => setForm({ ...form, account_subcategory: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {subcategoryOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account Code</Label>
              <Input value={form.account_code} placeholder="e.g. 1010" onChange={(e) => setForm({ ...form, account_code: e.target.value })} />
            </div>
            <div>
              <Label>Account Name</Label>
              {presetAccounts.length > 0 ? (
                <Select value={form.account_name} onValueChange={(v) => setForm({ ...form, account_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Select or type below..." /></SelectTrigger>
                  <SelectContent>
                    {presetAccounts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.account_name} placeholder="e.g. Cash on Hand" onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
              )}
            </div>
            <div>
              <Label>Opening Balance</Label>
              <Input type="number" value={form.opening_balance || ""} placeholder="0"
                onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            </div>
            <div>
              <Label>Balance Type</Label>
              <Select value={form.opening_balance_type} onValueChange={(v) => setForm({ ...form, opening_balance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit (Assets/Expenses)</SelectItem>
                  <SelectItem value="credit">Credit (Liabilities/Equity/Income)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); }} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.account_name.trim()} className="flex-1">
              {editingId ? "Update Account" : "Create Account"}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search accounts (e.g. Cash, Payable, Income)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Catalog suggestions while searching */}
      {search.trim() !== "" && (
        <div className="mb-4">
          {catalogMatches.length > 0 ? (
            <div className="luxury-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Standard accounts matching "{search.trim()}" — not yet added to your chart
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {catalogMatches.map((item) => (
                  <div key={`${item.category}|${item.name}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.categoryLabel} · {item.subcategory}</p>
                    </div>
                    <Button size="sm" onClick={() => handleQuickAdd(item)} className="bg-primary hover:bg-primary/90 h-7 px-2.5">
                      <Plus className="w-3 h-3 mr-1" />Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="luxury-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">No standard account matches "{search.trim()}".</p>
              <Button size="sm" onClick={() => { setEditingId(null); setForm({ account_name: search.trim(), account_code: "", account_category: "assets", account_subcategory: "", opening_balance: 0, opening_balance_type: "debit" }); setOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add "{search.trim()}" as new account
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="p-10 text-center text-muted-foreground">Loading chart of accounts...</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, accs]) => (
            <div key={cat} className="luxury-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-muted/30 border-b border-border">
                <h4 className="font-semibold text-foreground">{categoryLabels[cat] || cat}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Code</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Account Name</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-2.5 hidden sm:table-cell">Subcategory</th>
                      <th className="text-right font-medium text-muted-foreground px-5 py-2.5">Opening Balance</th>
                      <th className="text-left font-medium text-muted-foreground px-5 py-2.5 hidden md:table-cell">Type</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map((a) => (
                      <tr key={a.id} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{a.account_code || "—"}</td>
                        <td className="px-5 py-2.5 text-foreground font-medium">
                          {a.account_name}
                          {a.id === bankAccountId && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500" title="Automatically synced with the institution's bank balance">
                              <Link2 className="w-3 h-3" /> Live institution balance
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-muted-foreground hidden sm:table-cell">{a.account_subcategory || "—"}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-foreground">{money(a.opening_balance || 0)}</td>
                        <td className="px-5 py-2.5 text-muted-foreground hidden md:table-cell capitalize">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${a.opening_balance_type === "debit" ? "bg-amber-950/30 text-amber-500" : "bg-emerald-950/30 text-emerald-500"}`}>
                            {a.opening_balance_type}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(a)} className="h-8 w-8">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 border-t-2 border-border">
                      <td colSpan={3} className="px-5 py-2.5 font-semibold text-foreground">Subtotal</td>
                      <td className="px-5 py-2.5 text-right font-bold text-primary">
                        {money(accs.reduce((s, a) => s + (a.opening_balance || 0), 0))}
                      </td>
                      <td colSpan={2} className="px-5 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : search.trim() === "" ? (
        <div className="luxury-card rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">No accounts yet</p>
          <Button variant="outline" onClick={seedDefaults}>
            <BookOpen className="w-4 h-4 mr-2" /> Seed Default Chart of Accounts
          </Button>
        </div>
      ) : (
        <div className="luxury-card rounded-2xl p-8 text-center text-muted-foreground">
          No saved accounts match "{search.trim()}".
          {catalogMatches.length > 0
            ? " Add one from the suggestions above."
            : " Use the option above to add it as a new account."}
        </div>
      )}
    </div>
  );
}