import React, { useState } from "react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Check, X } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

export default function GuarantorRequests({ requests, onUpdate }) {
  const [sign, setSign] = useState({});
  const [msg, setMsg] = useState("");
  const { money } = useMoney();

  const accept = async (id) => {
    const s = (sign[id] || "").trim();
    if (!s) { setMsg("Type your full name to sign as guarantor."); return; }
    await backend.entities.LoanApplication.update(id, {
      guarantor_status: "accepted",
      guarantor_signature: s,
    });
    setSign({ ...sign, [id]: "" });
    setMsg("");
    onUpdate();
  };

  const reject = async (id) => {
    await backend.entities.LoanApplication.update(id, { guarantor_status: "rejected" });
    onUpdate();
  };

  if (!requests || requests.length === 0) return null;

  return (
    <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-amber-800/10 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-amber-100">Guarantor Requests</h3>
        <span className="ml-auto text-xs text-slate-400">{requests.length} pending</span>
      </div>
      {msg && <p className="text-sm text-rose-400 px-5 pt-3">{msg}</p>}
      <div className="divide-y divide-amber-800/5">
        {requests.map((a) => (
          <div key={a.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-medium text-amber-100">{a.member_name} ({a.member_number})</p>
                <p className="text-xs text-slate-400">
                  {money(a.requested_amount || 0)} · {a.requested_term_months || "—"} mo · <span className="capitalize">{a.loan_type || "normal"}</span>
                  {a.interest_rate ? ` · ${a.interest_rate}%` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Type your full name to sign"
                value={sign[a.id] || ""}
                onChange={(e) => setSign({ ...sign, [a.id]: e.target.value })}
                className="bg-slate-800/50 border-amber-800/30 text-amber-100 flex-1"
              />
              <Button size="sm" onClick={() => accept(a.id)} className="bg-emerald-700 hover:bg-emerald-800">
                <Check className="w-3.5 h-3.5 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => reject(a.id)} className="border-rose-700/50 text-rose-400 hover:bg-rose-950/30">
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}