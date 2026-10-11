import React, { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { scoped } from "@/lib/institutionScope";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Search, Eye, Pencil, Trash2, Mail, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import DateRangeFilter from "@/components/DateRangeFilter";
import { nextMemberNumber } from "@/lib/memberNumber";
import { exportToCSV } from "@/lib/csvExport";

export default function Members() {
  const [members, setMembers] = useState([]);
  const [shares, setShares] = useState([]);
  const [loans, setLoans] = useState([]);
  const [adminInstitution, setAdminInstitution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sendOtp, setSendOtp] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    member_number: "",
    email: "",
    phone: "",
    id_number: "",
    status: "active",
    joined_date: "",
  });

  const load = async () => {
    try {
      const [data, me, insts, shareData, loanData] = await Promise.all([
        backend.entities.Member.list(),
        backend.auth.me().catch(() => null),
        backend.entities.Institution.list().catch(() => []),
        backend.entities.Share.list().catch(() => []),
        backend.entities.Loan.list().catch(() => []),
      ]);
      setMembers(await scoped(data));
      setShares(await scoped(shareData));
      setLoans(await scoped(loanData));
      const mine =
        insts.find((i) => i.admin_user_id === me?.id) ||
        (me?.institution_id ? insts.find((i) => i.id === me.institution_id) : null) ||
        insts.find((i) => i.status === "approved") ||
        null;
      setAdminInstitution(mine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = members.filter((m) => {
    const matchSearch =
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.member_number?.toLowerCase().includes(search.toLowerCase());
    const date = m.joined_date;
    const matchFrom = !fromDate || (date && date >= fromDate);
    const matchTo = !toDate || (date && date <= toDate);
    return matchSearch && matchFrom && matchTo;
  });

  const handleSubmit = async () => {
    if (editingId) {
      await backend.entities.Member.update(editingId, form);
      if (form.status === "active" && form.email) {
        try {
          await backend.integrations.Core.SendEmail({
            to: form.email,
            from_name: "Veritas",
            subject: "Your membership has been approved",
            body: `Hello ${form.full_name},\n\nYour membership has been approved by your institution. Your account is now active.\n\nMember number: ${form.member_number}\n\nAccess the Member Portal to view your shares, loans, and make payments: ${window.location.origin}/portal\n\nWelcome,\nThe Veritas Team`,
          });
        } catch (e) {
          console.warn("Could not send member approval email:", e);
        }
      }
    } else {
      const payload = { ...form };
      if (!payload.member_number) {
        payload.member_number = nextMemberNumber(
          adminInstitution?.name,
          members.map((m) => m.member_number)
        );
      }
      if (!payload.institution_id && adminInstitution?.id) {
        payload.institution_id = adminInstitution.id;
      }
      await backend.entities.Member.create(payload);
      if (sendOtp && form.email) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        try {
          await backend.integrations.Core.SendEmail({
            to: form.email,
            from_name: "Veritas",
            subject: "Your member verification code",
            body: `Hello ${form.full_name},\n\nYou have been added as a member by your institution.\n\nMember number: ${payload.member_number}\nYour one-time verification code (OTP): ${otp}\n\nUse this code to activate your account on the Member Portal: ${window.location.origin}/portal\n\nThis code is for single use. If you did not expect this email, you can ignore it.\n\nWelcome,\nThe Veritas Team`,
          });
          toast({ title: "OTP sent", description: `A verification code was emailed to ${form.email}.` });
        } catch (e) {
          console.warn("Could not send member OTP email:", e);
          toast({ title: "Member saved", description: "Could not send the OTP email. Check the email address.", variant: "destructive" });
        }
      }
    }
    setOpen(false);
    setEditingId(null);
    setSendOtp(false);
    setForm({
      full_name: "",
      member_number: "",
      email: "",
      phone: "",
      id_number: "",
      status: "active",
      joined_date: "",
    });
    load();
  };

  const handleEdit = (m) => {
    setEditingId(m.id);
    setForm({
      full_name: m.full_name || "",
      member_number: m.member_number || "",
      email: m.email || "",
      phone: m.phone || "",
      id_number: m.id_number || "",
      status: m.status || "active",
      joined_date: m.joined_date || "",
    });
    setOpen(true);
  };

  const handleExportMembers = () => {
    const rows = members.map((m) => {
      const share = shares.find((s) => s.member_id === m.id);
      const memberLoans = loans.filter((l) => l.member_id === m.id);
      const activeLoan = memberLoans.find((l) => l.status === "active");
      return {
        Full_Name: m.full_name || "",
        Member_Number: m.member_number || "",
        Email: m.email || "",
        Phone: m.phone || "",
        ID_Number: m.id_number || "",
        Status: m.status || "",
        Joined_Date: m.joined_date || "",
        Share_Balance: share?.balance || 0,
        Contributions_Count: share?.contributions_count || 0,
        Active_Loan_Number: activeLoan?.loan_number || "",
        Active_Loan_Principal: activeLoan?.principal || 0,
        Active_Loan_Balance: activeLoan?.balance || 0,
        Active_Loan_Installment: activeLoan?.installment_amount || 0,
        Active_Loan_Status: activeLoan?.status || "",
        Total_Loans: memberLoans.length,
      };
    });
    exportToCSV(rows, "members-with-shares-and-loans.csv", [
      "Full_Name", "Member_Number", "Email", "Phone", "ID_Number", "Status",
      "Joined_Date", "Share_Balance", "Contributions_Count", "Active_Loan_Number",
      "Active_Loan_Principal", "Active_Loan_Balance", "Active_Loan_Installment",
      "Active_Loan_Status", "Total_Loans",
    ]);
  };

  const handleDelete = async (memberId) => {
    if (!confirm("Delete this member? This will remove their record. This cannot be undone.")) return;
    await backend.entities.Member.delete(memberId);
    load();
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Members
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your cooperative's member registry
          </p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" onClick={handleExportMembers} disabled={members.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export to Spreadsheet
        </Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Member" : "Add New Member"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Member Number</Label>
                  <Input
                    value={form.member_number}
                    onChange={(e) =>
                      setForm({ ...form, member_number: e.target.value })
                    }
                    placeholder={editingId ? "" : "Auto-generated from institution"}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID Number</Label>
                  <Input
                    value={form.id_number}
                    onChange={(e) =>
                      setForm({ ...form, id_number: e.target.value })
                    }
                    placeholder="National ID number"
                  />
                </div>
                <div>
                  <Label>Institution</Label>
                  <Input
                    value={adminInstitution?.name || "—"}
                    disabled
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Joined Date</Label>
                  <Input
                    type="date"
                    value={form.joined_date}
                    onChange={(e) =>
                      setForm({ ...form, joined_date: e.target.value })
                    }
                  />
                </div>
              </div>
              {!editingId && (
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Checkbox
                    checked={sendOtp}
                    onCheckedChange={(v) => setSendOtp(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-emerald-600" />
                      Send OTP to member's email
                    </span>
                    <span className="text-xs text-slate-500 block">
                      Email a one-time verification code so the member can activate their portal account. Optional.
                    </span>
                  </div>
                </label>
              )}
              <Button
                onClick={handleSubmit}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {editingId ? "Update Member" : "Save Member"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Member
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Number
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3 hidden lg:table-cell">
                    National ID
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3 hidden md:table-cell">
                    Contact
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Status
                  </th>
                  <th className="text-left font-medium text-slate-500 px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold">
                          {m.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">
                          {m.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {m.member_number}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">
                      {m.id_number || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">
                      {m.email || m.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          m.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Link to={`/members/${m.id}`}>
                          <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-700" onClick={() => handleEdit(m)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-rose-600" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}