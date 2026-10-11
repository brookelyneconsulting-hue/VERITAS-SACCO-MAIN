import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaymentForm from "@/components/PaymentForm";
import AmortizationSchedule from "@/components/AmortizationSchedule";
import GuarantorRequests from "@/components/GuarantorRequests";
import PortalAnalytics from "@/components/portal/PortalAnalytics";
import PortalShareSchedule from "@/components/portal/PortalShareSchedule";
import PortalDividends from "@/components/portal/PortalDividends";
import PortalAnnouncements from "@/components/portal/PortalAnnouncements";
import AnimatedCounter from "@/components/AnimatedCounter";
import DateRangeFilter from "@/components/DateRangeFilter";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LOAN_COLLATERAL_MULTIPLIER } from "@/lib/loanSource";
import { useMoney, moneyNow, setCurrency } from "@/lib/useMoney";
import {
  Banknote, TrendingUp, LogIn, ArrowLeft, Calendar, Percent, Plus,
  ClipboardList, Smartphone, Clock, UserPlus, CreditCard, CheckCircle2,
  CalendarClock, ShieldCheck, FileText, Bell, Search, LogOut,
} from "lucide-react";

const SUBSCRIPTION_FEE = 50;

export default function MemberPortal() {
  const [memberNumber, setMemberNumber] = useState("");
  const [member, setMember] = useState(null);
  const [shares, setShares] = useState([]);
  const [loans, setLoans] = useState([]);
  const [applications, setApplications] = useState([]);
  const [payments, setPayments] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [memberAccounts, setMemberAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [payDialog, setPayDialog] = useState(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ full_name: "", email: "", phone: "", id_number: "", institution_id: "" });
  const [enrollResult, setEnrollResult] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState("form");
  const [enrollPassword, setEnrollPassword] = useState("");
  const [enrollConfirm, setEnrollConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [appForm, setAppForm] = useState({ requested_amount: 0, purpose: "", requested_term_months: 12, loan_type: "normal", loan_source: "shares", deduction_start_date: "", guarantor_number: "", guarantor_id_number: "", member_signature: "", application_letter: "" });
  const [applyError, setApplyError] = useState("");
  const [letterUploading, setLetterUploading] = useState(false);
  const [instSetting, setInstSetting] = useState(null);
  const [guarantorRequests, setGuarantorRequests] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loginStep, setLoginStep] = useState("number");
  const [pendingMember, setPendingMember] = useState(null);
  const [idInput, setIdInput] = useState("");
  const [scheduleLoan, setScheduleLoan] = useState(null);
  const [instSearch, setInstSearch] = useState("");
  const [loanDateFilter, setLoanDateFilter] = useState({ from: "", to: "" });
  const [shareDateFilter, setShareDateFilter] = useState({ from: "", to: "" });
  const { money, symbol } = useMoney();

  useEffect(() => {
    backend.publicInstitutions()
      .then((data) => setInstitutions(data || []))
      .catch(() => {});
  }, []);

  // Real-time alert: refresh guarantor requests the moment a loan application
  // listing this member as guarantor is created or updated.
  useEffect(() => {
    if (!member) return;
    let unsub;
    try {
      unsub = backend.entities.LoanApplication.subscribe(() => {
        refreshGuarantorRequestsFor(member);
      });
    } catch {}
    return () => { if (unsub) unsub(); };
  }, [member]);

  const loadMemberData = async (m) => {
    const [s, l, apps, pays, mpays, maccts] = await Promise.all([
      backend.entities.Share.filter({ member_id: m.id }),
      backend.entities.Loan.filter({ member_id: m.id }),
      backend.entities.LoanApplication.filter({ member_id: m.id }),
      backend.entities.LoanPayment.filter({ member_id: m.id }),
      backend.entities.MemberPayment.filter({ member_id: m.id }),
      backend.entities.MemberAccount.filter({ member_id: m.id }).catch(() => []),
    ]);
    setMember(m);
    setShares(s);
    setLoans(l);
    setApplications(apps);
    setPayments(pays);
    setMemberPayments(mpays);
    setMemberAccounts(maccts || []);
    setLoginStep("number");
    setPendingMember(null);
    setIdInput("");
    try {
      const settings = await backend.entities.InstitutionSetting.filter({ institution_id: m.institution_id });
      setInstSetting(settings[0] || null);
      if (settings[0]?.currency) setCurrency(settings[0].currency);
    } catch { setInstSetting(null); }
    await refreshGuarantorRequestsFor(m);
  };

  const refreshGuarantorRequestsFor = async (m) => {
    try {
      const gReqs = await backend.entities.LoanApplication.filter({ guarantor_id: m.id });
      setGuarantorRequests(gReqs.filter((a) => a.guarantor_status === "pending" && a.status === "pending"));
    } catch { setGuarantorRequests([]); }
  };
  const refreshGuarantorRequests = () => refreshGuarantorRequestsFor(member);

  const rateForType = (type) => {
    if (!instSetting) return null;
    const r = type === "advance" ? instSetting.rate_advance : type === "emergency" ? instSetting.rate_emergency : instSetting.rate_normal;
    return r ?? null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (loginStep === "number") {
        if (!memberNumber.trim()) return;
        if (!memberNumber.trim()) return;
        setPendingMember({ member_number: memberNumber.trim() });
        setLoginStep("id");
        return;
      }
      // Step 2: verify ID number
      if (!pendingMember) return;
      if (String(pendingMember.id_number).trim().toLowerCase() !== String(idInput).trim().toLowerCase()) {
        setError("ID number does not match our records.");
        return;
      }
      const authenticatedMember = await backend.auth.memberLogin(pendingMember.member_number, idInput);
      await loadMemberData(authenticatedMember);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginBack = () => {
    setLoginStep("number");
    setPendingMember(null);
    setIdInput("");
    setError("");
  };

  const handleLogout = () => {
    setMember(null);
    setShares([]);
    setLoans([]);
    setApplications([]);
    setPayments([]);
    setMemberPayments([]);
    setMemberAccounts([]);
    setMemberNumber("");
    setLoginStep("number");
    setPendingMember(null);
    setIdInput("");
    setScheduleLoan(null);
    setGuarantorRequests([]);
    setInstSetting(null);
    setApplyError("");
  };

  const handleEnroll = async () => {
    if (!enrollForm.full_name.trim() || !enrollForm.email.trim()) return;
    if (!enrollForm.institution_id) { setError("Please select your institution"); return; }
    if (!enrollForm.id_number.trim()) { setError("Please enter your ID number"); return; }
    if (enrollPassword.length < 4) { setError("Password must be at least 4 characters"); return; }
    if (enrollPassword !== enrollConfirm) { setError("Passwords do not match"); return; }
    setEnrolling(true);
    setError("");
    try {
      await backend.auth.register({ email: enrollForm.email, password: enrollPassword });
      setEnrollStep("otp");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setEnrolling(false);
    }
  };

  const handleEnrollVerify = async () => {
    setEnrolling(true);
    setError("");
    try {
      const result = await backend.auth.verifyOtp({ email: enrollForm.email, otpCode });
      if (result?.access_token) backend.auth.setToken(result.access_token);
      await backend.auth.me();
      const selectedInst = institutions.find((i) => i.id === enrollForm.institution_id);
      const enrollment = await backend.enrollMember({
        full_name: enrollForm.full_name,
        email: enrollForm.email,
        phone: enrollForm.phone,
        id_number: enrollForm.id_number,
        institution_id: enrollForm.institution_id,
      });
      const newMember = enrollment.member;
      const nextNum = enrollment.member_number;

      try {
        await backend.integrations.Core.SendEmail({
          to: enrollForm.email,
          from_name: "Veritas",
          subject: "Welcome to Veritas — your enrollment is confirmed",
          body: `Hello ${enrollForm.full_name},\n\nYour member enrollment has been received and your account is now active on the platform.\n\nMember number: ${nextNum}\n\nPlease pay the ${moneyNow(SUBSCRIPTION_FEE)} subscription fee in the Member Portal to complete your membership. Your institution will fully activate your membership after verifying your payment.\n\nAccess the portal at: ${window.location.origin}/portal\n\nWelcome aboard,\nThe Veritas Team`,
        });
      } catch {}
      setEnrollResult({ member_number: nextNum, member_id: newMember.id });
      setEnrollStep("result");
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setEnrolling(false);
    }
  };

  const handleApply = async () => {
    setApplyError("");
    if (!appForm.member_signature?.trim()) { setApplyError("Please type your full name as your digital signature."); return; }
    if (!appForm.guarantor_number?.trim()) { setApplyError("Please enter your guarantor's member number."); return; }
    let guarantor = null;
    try {
      guarantor = await backend.memberLookup(appForm.guarantor_number.trim());
    } catch {}
    if (!guarantor) { setApplyError("Guarantor member number not found."); return; }
    if (guarantor.id === member.id) { setApplyError("You cannot be your own guarantor."); return; }
    if (guarantor.institution_id && member.institution_id && guarantor.institution_id !== member.institution_id) {
      setApplyError("Guarantor must be a member of your institution (SACCO)."); return;
    }
    if (appForm.guarantor_id_number?.trim() && guarantor.id_number && String(guarantor.id_number).toLowerCase() !== String(appForm.guarantor_id_number).trim().toLowerCase()) {
      setApplyError("Guarantor ID number does not match our records."); return;
    }
    // Collateral rule: shares (BOSA) or FOSA savings stay untouched, but the
    // requested amount is capped at a multiple of the chosen source balance.
    const sourceBalance = appForm.loan_source === "savings" ? fosaSavings : totalShares;
    const maxAmt = sourceBalance * LOAN_COLLATERAL_MULTIPLIER;
    const reqAmt = Number(appForm.requested_amount) || 0;
    if (reqAmt <= 0) { setApplyError("Enter the amount you want to borrow."); return; }
    if (reqAmt > maxAmt) {
      setApplyError(`With ${appForm.loan_source === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} of ${moneyNow(sourceBalance)}, you can borrow up to ${LOAN_COLLATERAL_MULTIPLIER}× that — ${moneyNow(maxAmt)}.`);
      return;
    }
    const rate = rateForType(appForm.loan_type);
    await backend.entities.LoanApplication.create({
      institution_id: member.institution_id,
      member_id: member.id,
      member_name: member.full_name,
      member_number: member.member_number,
      requested_amount: Number(appForm.requested_amount) || 0,
      purpose: appForm.purpose,
      requested_term_months: Number(appForm.requested_term_months) || 12,
      loan_type: appForm.loan_type || "normal",
      loan_source: appForm.loan_source || "shares",
      deduction_start_date: appForm.deduction_start_date || "",
      interest_rate: rate,
      guarantor_id: guarantor.id,
      guarantor_name: guarantor.full_name,
      guarantor_id_number: guarantor.id_number || appForm.guarantor_id_number || "",
      guarantor_status: "pending",
      application_letter: appForm.application_letter || "",
      member_signature: appForm.member_signature,
      status: "pending",
      application_date: new Date().toISOString().slice(0, 10),
    });
    try {
      if (guarantor.email) {
        await backend.integrations.Core.SendEmail({
          to: guarantor.email,
          from_name: "Veritas",
          subject: "You have a guarantor request",
          body: `Hello ${guarantor.full_name},\n\n${member.full_name} has listed you as a guarantor for a ${appForm.loan_type || "normal"} loan of ${moneyNow(Number(appForm.requested_amount) || 0)} over ${appForm.requested_term_months || 12} months.\n\nPlease log in to the Member Portal to accept or reject this request.\n\nPortal: ${window.location.origin}/portal\n\nVeritas Team`,
        });
      }
    } catch {}
    setApplyOpen(false);
    setAppForm({ requested_amount: 0, purpose: "", requested_term_months: 12, loan_type: "normal", loan_source: "shares", deduction_start_date: "", guarantor_number: "", guarantor_id_number: "", member_signature: "", application_letter: "" });
    const apps = await backend.entities.LoanApplication.filter({ member_id: member.id });
    setApplications(apps);
  };

  const handleLetterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLetterUploading(true);
    try {
      const res = await backend.integrations.Core.UploadFile({ file });
      setAppForm({ ...appForm, application_letter: res.file_url });
    } catch {
      setApplyError("Could not upload the letter. Please try again.");
    } finally {
      setLetterUploading(false);
    }
  };

  const handlePayment = async (paymentData) => {
    const today = new Date().toISOString().slice(0, 10);
    if (payDialog.type === "loan") {
      await backend.entities.LoanPayment.create({
        institution_id: member.institution_id,
        member_id: member.id,
        member_name: member.full_name,
        member_number: member.member_number,
        loan_id: payDialog.loan.id,
        loan_number: payDialog.loan.loan_number || "",
        amount: paymentData.amount,
        payment_ref: paymentData.payment_ref,
        phone_number: paymentData.phone_number,
        payment_date: today,
        status: "pending",
      });
      const pays = await backend.entities.LoanPayment.filter({ member_id: member.id });
      setPayments(pays);
    } else {
      await backend.entities.MemberPayment.create({
        institution_id: member.institution_id,
        member_id: member.id,
        member_name: member.full_name,
        member_number: member.member_number,
        payment_type: payDialog.type,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        payment_ref: paymentData.payment_ref,
        phone_number: paymentData.phone_number,
        payment_date: today,
        status: "pending",
      });
      const mpays = await backend.entities.MemberPayment.filter({ member_id: member.id });
      setMemberPayments(mpays);
    }
    setPayDialog(null);
  };

  const totalShares = shares.reduce((s, sh) => s + (sh.balance || 0), 0);
  const fosaSavings = memberAccounts.filter((a) => a.account_type === "fosa").reduce((s, a) => s + (a.balance || 0), 0);
  const activeLoans = loans.filter((l) => l.status === "active" || l.status === "pending");
  const outstandingBalance = activeLoans.reduce((s, l) => s + (l.balance || 0), 0);
  const totalInterest = activeLoans.reduce((s, l) => s + (l.interest_payable || 0), 0);
  const totalInstallment = activeLoans.reduce((s, l) => s + (l.installment_amount || 0), 0);

  const runningLoans = loans.filter((l) => l.status === "active");
  const inDateRange = (date, f) => {
    const d = date || "";
    return (!f.from || (d && d >= f.from)) && (!f.to || (d && d <= f.to));
  };
  const filteredLoans = loans.filter((l) => inDateRange(l.disbursement_date || l.payment_due_date, loanDateFilter));
  const filteredShares = shares.filter((s) => inDateRange(s.last_contribution_date, shareDateFilter));

  const statusStyles = {
    active: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-700",
    paid: "bg-blue-50 text-blue-700", defaulted: "bg-rose-50 text-rose-700",
  };

  // Login screen
  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-400 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Home Page
          </Link>
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-amber-800/30 shadow-2xl p-8">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                <Banknote className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <h1 className="font-bold text-amber-100 text-lg leading-tight">Member Portal</h1>
                <p className="text-xs text-slate-500">Veritas</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              {loginStep === "number"
                ? "Enter your unique member number to access your account."
                : `Hi ${pendingMember?.full_name?.split(" ")[0] || ""}, verify your identity with your ID number.`}
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginStep === "number" ? (
                <div>
                  <Label htmlFor="memberNumber" className="text-amber-100">Member Number</Label>
                  <Input id="memberNumber" placeholder="e.g. SUN001" value={memberNumber}
                    onChange={(e) => setMemberNumber(e.target.value)} disabled={loading}
                    className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                </div>
              ) : (
                <div>
                  <Label htmlFor="idInput" className="text-amber-100">ID Number</Label>
                  <Input id="idInput" placeholder="Enter your national ID number" value={idInput}
                    onChange={(e) => setIdInput(e.target.value)} disabled={loading} autoFocus
                    className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                </div>
              )}
              {error && <p className="text-sm text-rose-400 bg-rose-950/30 rounded-lg px-3 py-2">{error}</p>}
              {loginStep === "id" && (
                <button type="button" onClick={handleLoginBack} className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Use a different member number
                </button>
              )}
              <Button type="submit" disabled={loading || (loginStep === "number" ? !memberNumber.trim() : !idInput.trim())}
                className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-semibold">
                {loginStep === "id" ? <ShieldCheck className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                {loading ? "Loading..." : loginStep === "number" ? "Continue" : "Verify & View Details"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-amber-800/20">
              <Dialog open={enrollOpen} onOpenChange={(o) => { setEnrollOpen(o); if (!o) { setEnrollResult(null); setEnrollStep("form"); setEnrollForm({ full_name: "", email: "", phone: "", id_number: "", institution_id: "" }); setEnrollPassword(""); setEnrollConfirm(""); setOtpCode(""); setInstSearch(""); setError(""); }}}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-amber-700/50 text-amber-400 hover:bg-amber-950/30">
                    <UserPlus className="w-4 h-4 mr-2" /> Enroll as New Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-amber-800/30">
                  <DialogHeader><DialogTitle className="text-amber-100">Member Enrollment</DialogTitle></DialogHeader>
                  {enrollStep === "result" ? (
                    <div className="space-y-4 py-4">
                      <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-5 text-center">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                        <p className="text-emerald-300 font-medium mb-2">Enrollment Successful!</p>
                        <p className="text-sm text-slate-400 mb-3">Your member number is:</p>
                        <p className="text-2xl font-bold text-amber-400 font-mono">{enrollResult.member_number}</p>
                      </div>
                      <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4">
                        <p className="text-sm text-amber-300 font-medium mb-3">Pay {symbol}{SUBSCRIPTION_FEE} Subscription Fee Now</p>
                        <p className="text-xs text-slate-400 mb-4">Complete your membership by paying the subscription fee. Your account will be activated once an admin verifies your payment.</p>
                        {enrollResult.paymentSubmitted ? (
                          <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-4 text-center">
                            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                            <p className="text-sm text-emerald-300 font-medium">Payment submitted for verification!</p>
                            <p className="text-xs text-slate-400 mt-1">Your account will be activated once an admin approves your payment.</p>
                          </div>
                        ) : (
                          <PaymentForm
                            defaultAmount={SUBSCRIPTION_FEE}
                            defaultPhone={enrollForm.phone || ""}
                            submitLabel="Submit for Verification"
                            onSubmit={async (paymentData) => {
                              const today = new Date().toISOString().slice(0, 10);
                              await backend.entities.MemberPayment.create({
                                institution_id: enrollForm.institution_id,
                                member_id: enrollResult.member_id,
                                member_name: enrollForm.full_name,
                                member_number: enrollResult.member_number,
                                payment_type: "subscription",
                                amount: paymentData.amount,
                                payment_method: paymentData.payment_method,
                                payment_ref: paymentData.payment_ref,
                                phone_number: paymentData.phone_number,
                                payment_date: today,
                                status: "pending",
                              });
                              setEnrollResult({ ...enrollResult, paymentSubmitted: true });
                            }}
                          />
                        )}
                      </div>
                      <Button onClick={() => { setEnrollOpen(false); setEnrollResult(null); setEnrollStep("form"); setMemberNumber(enrollResult.member_number); setEnrollForm({ full_name: "", email: "", phone: "", id_number: "", institution_id: "" }); setEnrollPassword(""); setEnrollConfirm(""); setOtpCode(""); setInstSearch(""); }}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-semibold">
                        {enrollResult.paymentSubmitted ? "Continue to Login" : "Skip & Pay Later"}
                      </Button>
                    </div>
                  ) : enrollStep === "otp" ? (
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-slate-400 text-center">We sent a 6-digit code to <span className="text-amber-300">{enrollForm.email}</span></p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
                      <Button onClick={handleEnrollVerify} disabled={enrolling || otpCode.length < 6}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-semibold">
                        {enrolling ? "Verifying..." : "Verify & Complete Enrollment"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 py-2">
                      <div>
                        <Label className="text-amber-100">Full Name</Label>
                        <Input value={enrollForm.full_name} placeholder="John Doe"
                          onChange={(e) => setEnrollForm({ ...enrollForm, full_name: e.target.value })}
                          className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                      </div>
                      <div>
                        <Label className="text-amber-100">Email</Label>
                        <Input type="email" value={enrollForm.email} placeholder="john@example.com"
                          onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                          className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                      </div>
                      <div>
                        <Label className="text-amber-100">Phone</Label>
                        <Input value={enrollForm.phone} placeholder="0712345678"
                          onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                          className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                      </div>
                      <div>
                        <Label className="text-amber-100">Institution</Label>
                        {(() => {
                          const selectedInst = institutions.find((i) => i.id === enrollForm.institution_id);
                          if (selectedInst) {
                            return (
                              <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-800/30 rounded-md px-3 h-9">
                                <span className="text-sm text-emerald-300 truncate">
                                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />{selectedInst.name}
                                </span>
                                <button type="button" onClick={() => setEnrollForm({ ...enrollForm, institution_id: "" })}
                                  className="text-xs text-slate-400 hover:text-amber-400">Change</button>
                              </div>
                            );
                          }
                          const matches = institutions.filter((i) =>
                            i.name.toLowerCase().includes(instSearch.trim().toLowerCase()));
                          return (
                            <div>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input value={instSearch} placeholder="Type to search your institution..."
                                  onChange={(e) => setInstSearch(e.target.value)}
                                  className="bg-slate-800/50 border-amber-800/30 text-amber-100 pl-9" />
                              </div>
                              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-amber-800/20 bg-slate-800/30">
                                {institutions.length === 0 ? (
                                  <p className="px-3 py-2.5 text-xs text-slate-500">No registered institutions available yet.</p>
                                ) : matches.length === 0 ? (
                                  <p className="px-3 py-2.5 text-xs text-slate-500">No institution matches "{instSearch}".</p>
                                ) : matches.map((i) => (
                                  <button type="button" key={i.id}
                                    onClick={() => { setEnrollForm({ ...enrollForm, institution_id: i.id }); setInstSearch(""); }}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-amber-950/40 transition-colors">
                                    <span className="text-sm text-amber-100 truncate">{i.name}</span>
                                    <span className="text-[11px] text-slate-500 capitalize flex-shrink-0">{i.type}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <Label className="text-amber-100">ID Number</Label>
                        <Input value={enrollForm.id_number} placeholder="National ID number"
                          onChange={(e) => setEnrollForm({ ...enrollForm, id_number: e.target.value })}
                          className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-amber-100">Password</Label>
                          <Input type="password" value={enrollPassword} placeholder="••••"
                            onChange={(e) => setEnrollPassword(e.target.value)}
                            className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                        </div>
                        <div>
                          <Label className="text-amber-100">Confirm</Label>
                          <Input type="password" value={enrollConfirm} placeholder="••••"
                            onChange={(e) => setEnrollConfirm(e.target.value)}
                            className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                        </div>
                      </div>
                      {error && <p className="text-sm text-rose-400">{error}</p>}
                      <Button onClick={handleEnroll} disabled={enrolling || !enrollForm.full_name.trim() || !enrollForm.email.trim() || !enrollForm.institution_id}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-semibold">
                        {enrolling ? "Sending code..." : "Enroll Now"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Member dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/10">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-amber-800/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-semibold text-amber-100 leading-tight">Member Portal</h1>
              <p className="text-[11px] text-slate-500">Veritas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg text-slate-300 hover:text-amber-400 hover:bg-amber-950/30 transition" title="Guarantor notifications">
              <Bell className="w-5 h-5" />
              {guarantorRequests.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {guarantorRequests.length}
                </span>
              )}
            </button>
            <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-amber-400">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl lg:text-2xl font-bold text-amber-100 tracking-tight">Welcome, {member.full_name}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              Member #{member.member_number} · <span className="capitalize">{member.status}</span>
              {member.subscription_status && member.subscription_status !== "none" && (
                <> · Subscription: <span className="capitalize">{member.subscription_status}</span></>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {member.subscription_status !== "paid" && (
              <Button onClick={() => setPayDialog({ type: "subscription", defaultAmount: SUBSCRIPTION_FEE })}
                className="bg-amber-600 hover:bg-amber-700 text-slate-950 font-semibold">
                <CreditCard className="w-4 h-4 mr-2" /> Pay Subscription ({symbol}{SUBSCRIPTION_FEE})
              </Button>
            )}
            <Button variant="outline" onClick={() => setPayDialog({ type: "shares", defaultAmount: 100 })}
              className="border-amber-700/50 text-amber-400 hover:bg-amber-950/30">
              <TrendingUp className="w-4 h-4 mr-2" /> Buy Shares
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-950/30", raw: totalShares, fmt: money, label: "Total Shares" },
            { icon: Banknote, color: "text-amber-400", bg: "bg-amber-950/30", raw: outstandingBalance, fmt: money, label: "Loan Balance" },
            { icon: Percent, color: "text-rose-400", bg: "bg-rose-950/30", raw: totalInterest, fmt: money, label: "Interest Payable" },
            { icon: Calendar, color: "text-blue-400", bg: "bg-blue-950/30", raw: totalInstallment, fmt: money, label: "Monthly Installment" },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 p-5">
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold text-amber-100"><AnimatedCounter value={card.raw} format={card.fmt} /></p>
                <p className="text-sm text-slate-400">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Subscription status banner */}
        {member.subscription_status !== "paid" && (
          <div className="bg-amber-950/30 border border-amber-800/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-200">Subscription Fee Pending</p>
              <p className="text-xs text-amber-400/70">Pay the {symbol}{SUBSCRIPTION_FEE} subscription fee to activate your membership.</p>
            </div>
            <Button size="sm" onClick={() => setPayDialog({ type: "subscription", defaultAmount: SUBSCRIPTION_FEE })}
              className="bg-amber-600 hover:bg-amber-700 text-slate-950">
              Pay Now
            </Button>
          </div>
        )}

        {/* Announcements from the institution */}
        <PortalAnnouncements institutionId={member.institution_id} />

        {/* Financial analytics */}
        <PortalAnalytics shares={shares} loans={loans} payments={payments} memberPayments={memberPayments} />

        {/* Guarantor requests */}
        <GuarantorRequests member={member} requests={guarantorRequests} onUpdate={refreshGuarantorRequests} />

        {/* Loan Applications */}
        <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-amber-800/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-amber-100">My Loan Applications</h3>
            </div>
            <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-slate-950">
                  <Plus className="w-4 h-4 mr-1" /> Apply for Loan
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-amber-800/30">
                <DialogHeader><DialogTitle className="text-amber-100">Apply for a Loan</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Current position: shares present + running loans */}
                  <div className="rounded-xl border border-amber-800/30 bg-slate-800/50 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Shares present</span>
                      <span className="font-semibold text-emerald-400">{money(totalShares)}</span>
                    </div>
                    <div className="border-t border-amber-800/20 pt-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Running loans</p>
                      {runningLoans.length === 0 ? (
                        <p className="text-sm text-slate-500">No running loans.</p>
                      ) : (
                        <div className="space-y-1">
                          {runningLoans.map((l) => (
                            <div key={l.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{l.loan_number || "Loan"} · {money(l.principal || 0)} principal</span>
                              <span className="font-semibold text-amber-100">{money(l.balance || 0)} left</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-sm border-t border-amber-800/20 pt-1">
                            <span className="text-slate-400">Outstanding total</span>
                            <span className="font-bold text-rose-300">{money(runningLoans.reduce((s, l) => s + (l.balance || 0), 0))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-100">Loan Source (collateral)</Label>
                    <Select value={appForm.loan_source} onValueChange={(v) => setAppForm({ ...appForm, loan_source: v })}>
                      <SelectTrigger className="bg-slate-800/50 border-amber-800/30 text-amber-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shares">From Shares (BOSA)</SelectItem>
                        <SelectItem value="savings">From Savings (FOSA)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Your {appForm.loan_source === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} stay untouched — you can borrow up to {LOAN_COLLATERAL_MULTIPLIER}× the balance.
                    </p>
                    {appForm.loan_source === "savings" && fosaSavings <= 0 ? (
                      <p className="text-xs text-rose-400 mt-1">
                        You have no Savings (FOSA) balance yet — you cannot borrow against savings.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-200 mt-1">
                        {appForm.loan_source === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"} balance:{" "}
                        <span className="font-semibold text-emerald-400">{money(appForm.loan_source === "savings" ? fosaSavings : totalShares)}</span>
                        {" "}· Max loan: <span className="font-semibold text-amber-100">{moneyNow((appForm.loan_source === "savings" ? fosaSavings : totalShares) * LOAN_COLLATERAL_MULTIPLIER)}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-amber-100">Amount Requested ({symbol.trim()})</Label>
                    <Input type="number" value={appForm.requested_amount}
                      onChange={(e) => setAppForm({ ...appForm, requested_amount: e.target.value })}
                      className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                  </div>
                  <div>
                    <Label className="text-amber-100">Term (months)</Label>
                    <Input type="number" value={appForm.requested_term_months}
                      onChange={(e) => setAppForm({ ...appForm, requested_term_months: e.target.value })}
                      className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                  </div>
                  <div>
                    <Label className="text-amber-100">Loan Type</Label>
                    <Select value={appForm.loan_type} onValueChange={(v) => setAppForm({ ...appForm, loan_type: v })}>
                      <SelectTrigger className="bg-slate-800/50 border-amber-800/30 text-amber-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal Loan</SelectItem>
                        <SelectItem value="advance">Advance Loan</SelectItem>
                        <SelectItem value="emergency">Emergency Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-amber-100">Purpose</Label>
                    <Textarea placeholder="What will this loan be used for?" value={appForm.purpose}
                      onChange={(e) => setAppForm({ ...appForm, purpose: e.target.value })} rows={3}
                      className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                  </div>
                  <div>
                    <Label className="text-amber-100">Deduction Start Date</Label>
                    <Input type="date" value={appForm.deduction_start_date}
                      onChange={(e) => setAppForm({ ...appForm, deduction_start_date: e.target.value })}
                      className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                  </div>
                  {rateForType(appForm.loan_type) != null && (
                    <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 text-sm text-amber-200">
                      Applicable interest rate: <span className="font-semibold text-amber-100">{rateForType(appForm.loan_type)}%</span> ({appForm.loan_type} loan)
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-amber-100">Guarantor Member No.</Label>
                      <Input value={appForm.guarantor_number} placeholder="e.g. SUN001"
                        onChange={(e) => setAppForm({ ...appForm, guarantor_number: e.target.value })}
                        className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                    </div>
                    <div>
                      <Label className="text-amber-100">Guarantor ID Number</Label>
                      <Input value={appForm.guarantor_id_number} placeholder="National ID"
                        onChange={(e) => setAppForm({ ...appForm, guarantor_id_number: e.target.value })}
                        className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-100 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Application Letter (PDF/Doc/Image)</Label>
                    <Input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleLetterUpload}
                      className="bg-slate-800/50 border-amber-800/30 text-amber-100 file:text-amber-200" />
                    {letterUploading && <p className="text-xs text-amber-300 mt-1">Uploading...</p>}
                    {appForm.application_letter && <p className="text-xs text-emerald-400 mt-1">Letter attached.</p>}
                  </div>
                  <div>
                    <Label className="text-amber-100">Digital Signature (type your full name)</Label>
                    <Input value={appForm.member_signature} placeholder={member?.full_name || "Your full name"}
                      onChange={(e) => setAppForm({ ...appForm, member_signature: e.target.value })}
                      className="bg-slate-800/50 border-amber-800/30 text-amber-100" />
                    <p className="text-[11px] text-slate-500 mt-1">By typing your name you sign this application electronically.</p>
                  </div>
                  {applyError && <p className="text-sm text-rose-400">{applyError}</p>}
                  <Button onClick={handleApply} className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950">Submit Application</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {applications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              No applications yet. Apply for a loan to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-800/10 bg-slate-800/30">
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Date</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3">Requested</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Term</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Status</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Admin Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.id} className="border-b border-amber-800/5">
                      <td className="px-5 py-3.5 text-slate-400">{a.application_date ? new Date(a.application_date).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-amber-100">
                        {money(a.requested_amount || 0)}
                        {a.loan_source && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-950/40 text-amber-300">
                            {a.loan_source === "savings" ? "Savings (FOSA)" : "Shares (BOSA)"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 hidden sm:table-cell">{a.requested_term_months || "—"} mo</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[a.status] || "bg-slate-100 text-slate-600"}`}>{a.status}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 italic text-xs hidden md:table-cell max-w-xs truncate">{a.admin_reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Loans */}
        <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-amber-800/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-semibold text-amber-100">My Loans</h3>
            <DateRangeFilter
              fromDate={loanDateFilter.from}
              toDate={loanDateFilter.to}
              onFromChange={(v) => setLoanDateFilter((f) => ({ ...f, from: v }))}
              onToChange={(v) => setLoanDateFilter((f) => ({ ...f, to: v }))}
              onClear={() => setLoanDateFilter({ from: "", to: "" })}
            />
          </div>
          {filteredLoans.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Banknote className="w-9 h-9 mx-auto mb-2 text-slate-700" /> No loan records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-800/10 bg-slate-800/30">
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Loan #</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3">Principal</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3">Interest</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3">Balance</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Installment</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Due Date</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.map((l) => (
                    <tr key={l.id} className="border-b border-amber-800/5">
                      <td className="px-5 py-3.5 font-medium text-amber-100">{l.loan_number || "—"}</td>
                      <td className="px-5 py-3.5 text-right text-slate-400">{money(l.principal || 0)}</td>
                      <td className="px-5 py-3.5 text-right text-rose-400 font-medium">{money(l.interest_payable || 0)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-amber-100">{money(l.balance || 0)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-400 hidden sm:table-cell">{money(l.installment_amount || 0)}</td>
                      <td className="px-5 py-3.5 text-slate-400 hidden md:table-cell">{l.payment_due_date ? new Date(l.payment_due_date).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[l.status] || "bg-slate-100 text-slate-600"}`}>{l.status}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setScheduleLoan(l)}
                            className="border-amber-700/50 text-amber-400 hover:bg-amber-950/30">
                            <CalendarClock className="w-3.5 h-3.5 mr-1" /> Schedule
                          </Button>
                          {l.status === "active" && (
                            <Button size="sm" onClick={() => setPayDialog({ type: "loan", loan: l, defaultAmount: l.installment_amount || 0 })}
                              className="bg-emerald-700 hover:bg-emerald-800">
                              <Smartphone className="w-3.5 h-3.5 mr-1" /> Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment History (loan + member payments) */}
        <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-amber-800/10 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-amber-100">My Payment History</h3>
          </div>
          {[...payments, ...memberPayments].sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || "")).length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              No payments yet. Use the Pay buttons to make a payment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-800/10 bg-slate-800/30">
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Date</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Type</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Ref</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3">Amount</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...payments.map((p) => ({ ...p, pay_type: "Loan" })),
                    ...memberPayments.map((p) => ({ ...p, pay_type: p.payment_type === "shares" ? "Shares" : "Subscription" }))]
                    .sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || ""))
                    .map((p) => (
                    <tr key={p.pay_type + p.id} className="border-b border-amber-800/5">
                      <td className="px-5 py-3.5 text-slate-400">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.pay_type === "Shares" ? "bg-blue-950/50 text-blue-400" : p.pay_type === "Subscription" ? "bg-purple-950/50 text-purple-400" : "bg-amber-950/50 text-amber-400"}`}>
                          {p.pay_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5"><code className="text-xs px-2 py-0.5 bg-slate-800 rounded text-amber-300">{p.payment_ref}</code></td>
                      <td className="px-5 py-3.5 text-right font-semibold text-amber-100">{money(p.amount || 0)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          p.status === "approved" ? "bg-emerald-950/50 text-emerald-400"
                          : p.status === "rejected" ? "bg-rose-950/50 text-rose-400"
                          : "bg-amber-950/50 text-amber-400"}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {(payments.length > 0 || memberPayments.length > 0) && (
                  <tfoot>
                    <tr className="bg-slate-800/30 border-t-2 border-amber-800/20">
                      <td colSpan={3} className="px-5 py-3 font-semibold text-amber-100">Total</td>
                      <td className="px-5 py-3 text-right font-bold text-amber-400">
                        {money([...payments, ...memberPayments].reduce((s, p) => s + (p.amount || 0), 0))}
                      </td>
                      <td className="px-5 py-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Shares */}
        <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-amber-800/15 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-800/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-semibold text-amber-100">My Shares</h3>
            <DateRangeFilter
              fromDate={shareDateFilter.from}
              toDate={shareDateFilter.to}
              onFromChange={(v) => setShareDateFilter((f) => ({ ...f, from: v }))}
              onToChange={(v) => setShareDateFilter((f) => ({ ...f, to: v }))}
              onClear={() => setShareDateFilter({ from: "", to: "" })}
            />
          </div>
          {filteredShares.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <TrendingUp className="w-9 h-9 mx-auto mb-2 text-slate-700" /> No share records yet. Buy shares to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-800/10 bg-slate-800/30">
                    <th className="text-left font-medium text-slate-400 px-5 py-3">Contributions</th>
                    <th className="text-left font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Last Contribution</th>
                    <th className="text-right font-medium text-slate-400 px-5 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShares.map((s) => (
                    <tr key={s.id} className="border-b border-amber-800/5">
                      <td className="px-5 py-3.5 text-slate-400">{s.contributions_count || 0}</td>
                      <td className="px-5 py-3.5 text-slate-400 hidden sm:table-cell">{s.last_contribution_date ? new Date(s.last_contribution_date).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-400">{money(s.balance || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                {filteredShares.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800/30 border-t-2 border-amber-800/20">
                      <td className="px-5 py-3 font-semibold text-amber-100">Total</td>
                      <td className="px-5 py-3 hidden sm:table-cell"></td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-400">{money(filteredShares.reduce((s, sh) => s + (sh.balance || 0), 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Share Schedule */}
        <PortalShareSchedule memberId={member.id} memberName={member.full_name} share={shares[0]} memberPayments={memberPayments} />

        {/* My Dividends */}
        <PortalDividends memberId={member.id} />
      </main>

      {/* Unified Payment Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="bg-slate-900 border-amber-800/30">
          <DialogHeader>
            <DialogTitle className="text-amber-100">
              {payDialog?.type === "loan" ? "Pay Loan" : payDialog?.type === "subscription" ? "Pay Subscription Fee" : "Buy Shares"}
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              {payDialog.type === "loan" && payDialog.loan && (
                <div className="bg-slate-800/50 rounded-xl p-4 text-sm">
                  <div className="flex justify-between mb-1"><span className="text-slate-400">Loan #</span><span className="font-medium text-amber-100">{payDialog.loan.loan_number || "—"}</span></div>
                  <div className="flex justify-between mb-1"><span className="text-slate-400">Outstanding Balance</span><span className="font-medium text-amber-100">{money(payDialog.loan.balance || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Monthly Installment</span><span className="font-medium text-amber-100">{money(payDialog.loan.installment_amount || 0)}</span></div>
                </div>
              )}
              {payDialog.type === "subscription" && (
                <div className="bg-amber-950/30 rounded-xl p-4 text-sm text-amber-300">
                  Pay the {symbol}{SUBSCRIPTION_FEE} membership subscription fee. Your account will be activated once an admin verifies your payment.
                </div>
              )}
              {payDialog.type === "shares" && (
                <div className="bg-emerald-950/30 rounded-xl p-4 text-sm text-emerald-300">
                  Enter the amount of shares you'd like to purchase. Shares will be credited to your account once an admin verifies your payment.
                </div>
              )}
              <PaymentForm
                defaultAmount={payDialog.defaultAmount || 0}
                defaultPhone={member.phone || ""}
                onSubmit={handlePayment}
                submitLabel="Submit Payment for Verification"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Loan amortization schedule */}
      <Dialog open={!!scheduleLoan} onOpenChange={(o) => !o && setScheduleLoan(null)}>
        <DialogContent className="bg-slate-900 border-amber-800/30 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Loan Amortization Schedule</DialogTitle>
          </DialogHeader>
          {scheduleLoan && (
            <AmortizationSchedule loan={scheduleLoan} memberName={member?.full_name} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}