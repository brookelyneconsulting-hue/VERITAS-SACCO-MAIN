import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { getFlatAccounts } from "@/lib/chartOfAccounts";
import { useMoney } from "@/lib/useMoney";

const flatAccounts = getFlatAccounts();

export default function JournalEntriesTab() {
  const { money } = useMoney();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    lines: [{ account: "", debit: 0, credit: 0 }],
  });

  const load = async () => {
    try {
      const data = await backend.entities.JournalEntry.list("-date");
      setEntries(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Group by entry_number
  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.entry_number]) acc[e.entry_number] = [];
    acc[e.entry_number].push(e);
    return acc;
  }, {});
  const entryNumbers = Object.keys(grouped).sort().reverse();

  const totalDebits = form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredits = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebits === totalCredits && totalDebits > 0;

  const addLine = () => setForm({ ...form, lines: [...form.lines, { account: "", debit: 0, credit: 0 }] });
  const removeLine = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  const updateLine = (i, field, value) => {
    const lines = [...form.lines];
    lines[i] = { ...lines[i], [field]: value };
    setForm({ ...form, lines });
  };

  const handleSubmit = async () => {
    if (!balanced) return;
    const entryNumber = `JE-${Date.now().toString().slice(-6)}`;
    const records = form.lines
      .filter((l) => l.account && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => {
        const acc = flatAccounts.find((a) => `${a.category}|${a.name}` === l.account);
        return {
          entry_number: entryNumber,
          date: form.date,
          description: form.description,
          account_category: acc.category,
          account_subcategory: acc.subcategory,
          account_name: acc.name,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        };
      });
    if (records.length < 2) return;
    await backend.entities.JournalEntry.bulkCreate(records);
    setOpen(false);
    setForm({ date: new Date().toISOString().slice(0, 10), description: "", lines: [{ account: "", debit: 0, credit: 0 }] });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Journal Entries</h3>
        <Button onClick={() => setOpen(!open)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* New Entry Form */}
      {open && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly rent payment" />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2 mb-3">
            {form.lines.map((line, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <select
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={line.account}
                  onChange={(e) => updateLine(i, "account", e.target.value)}
                >
                  <option value="">Select account...</option>
                  {["assets", "liabilities", "equity", "income", "expenses"].map((cat) => (
                    <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                      {flatAccounts.filter((a) => a.category === cat).map((a) => (
                        <option key={`${a.category}|${a.name}`} value={`${a.category}|${a.name}`}>
                          {a.subcategory} — {a.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="Debit"
                  className="w-full sm:w-28"
                  value={line.debit || ""}
                  onChange={(e) => updateLine(i, "debit", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Credit"
                  className="w-full sm:w-28"
                  value={line.credit || ""}
                  onChange={(e) => updateLine(i, "credit", e.target.value)}
                />
                {form.lines.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeLine(i)} className="text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Line
            </Button>
            <div className="flex items-center gap-4 text-sm">
              <span className={balanced ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                Debits: {money(totalDebits)} | Credits: {money(totalCredits)}
                {balanced ? " ✓ Balanced" : " ✗ Not balanced"}
              </span>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!balanced} className="flex-1 bg-primary hover:bg-primary/90">
              Save Journal Entry
            </Button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="p-10 text-center text-muted-foreground">Loading...</div>
      ) : entryNumbers.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No journal entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entryNumbers.map((num) => {
            const lines = grouped[num];
            const debits = lines.reduce((s, l) => s + (l.debit || 0), 0);
            return (
              <div key={num} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-3">
                    <code className="text-xs font-mono text-primary font-medium">{num}</code>
                    <span className="text-sm font-medium text-foreground">{lines[0].description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lines[0].date ? new Date(lines[0].date).toLocaleDateString() : "—"}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-border/30">
                        <td className="px-5 py-2 text-muted-foreground text-xs capitalize">{l.account_category}</td>
                        <td className="px-5 py-2 text-foreground">{l.account_name}</td>
                        <td className="px-5 py-2 text-right text-foreground">
                          {(l.debit || 0) > 0 ? money(l.debit || 0) : "—"}
                        </td>
                        <td className="px-5 py-2 text-right text-foreground">
                          {(l.credit || 0) > 0 ? money(l.credit || 0) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20">
                      <td colSpan={2} className="px-5 py-2 text-right text-xs font-medium text-muted-foreground">Total</td>
                      <td className="px-5 py-2 text-right font-semibold text-foreground">{money(debits)}</td>
                      <td className="px-5 py-2 text-right font-semibold text-foreground">{money(debits)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}