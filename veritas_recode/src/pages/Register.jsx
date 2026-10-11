import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, Building2, Phone, MapPin, FileText, User, Check } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";

export default function Register() {
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [institutionType, setInstitutionType] = useState("sacco");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [plan, setPlan] = useState("starter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    setLoading(true);
    try {
      await backend.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await backend.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        backend.auth.setToken(result.access_token);
      }
      const me = await backend.auth.me();
      // Create pending institution record
      const inst = await backend.entities.Institution.create({
        name: institutionName,
        type: institutionType,
        registration_number: registrationNumber,
        email,
        phone,
        physical_address: address,
        status: "pending",
        plan,
        admin_name: adminName,
        admin_user_id: me.id,
        joined_date: new Date().toISOString().split("T")[0],
      });
      // Link user to institution + set pending status
      await backend.auth.updateMe({
        institution_id: inst.id,
        institution_name: institutionName,
        account_status: "pending",
      });
      // Notify platform owner of the new registration
      try {
        await backend.integrations.Core.SendEmail({
          to: "brookelyne.consulting@gmail.com",
          subject: `New Institution Registration: ${institutionName}`,
          body: `A new institution has registered and is awaiting approval.\n\nInstitution: ${institutionName}\nType: ${institutionType}\nPlan: ${plan}\nAdmin: ${adminName}\nEmail: ${email}\nPhone: ${phone}\nRegistration #: ${registrationNumber}\nAddress: ${address}\n\nReview and approve from the Admin Approvals dashboard.`,
        });
      } catch (e) {
        // Non-blocking: registration should still complete
      }
      // Route through the registered root (deep paths 404 on the published app);
      // the Landing page sends the now-signed-in user to the approval screen client-side.
      window.location.href = "/?next=" + encodeURIComponent("/pending-approval");
    } catch (err) {
      setError(err.message || "Verification failed. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await backend.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a 6-digit code to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div className="flex justify-center mb-6">
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
        <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>) : "Verify & Complete Registration"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Resend</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Building2}
      title="Register your institution"
      subtitle="Create an account for your SACCO or lending institution"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Institution Details</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="instName">Institution Name</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="instName" placeholder="e.g. Sunrise SACCO" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} className="pl-10 h-11" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="type">Institution Type</Label>
            <select
              id="type"
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="sacco">SACCO</option>
              <option value="microfinance">Microfinance</option>
              <option value="credit_union">Credit Union</option>
              <option value="savings_group">Savings Group</option>
              <option value="chama">Chama</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="regNum">Reg. Number</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="regNum" placeholder="SAS/1234" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="pl-10 h-11" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="phone" placeholder="+254 712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10 h-11" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr">Physical Address</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="addr" placeholder="Nairobi, Kenya" value={address} onChange={(e) => setAddress(e.target.value)} className="pl-10 h-11" />
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <Label className="text-xs uppercase text-muted-foreground">Choose Your Plan</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlan("starter")}
              className={`text-left p-4 rounded-xl border transition-all ${
                plan === "starter" ? "border-primary gold-glow bg-primary/5" : "border-input hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">Starter</span>
                {plan === "starter" && <Check className="w-4 h-4 text-primary" />}
              </div>
              <div className="font-heading text-2xl font-bold gold-text mt-1">
                $50<span className="text-sm text-muted-foreground font-body">/year</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Up to 100 members</p>
            </button>
            <button
              type="button"
              onClick={() => setPlan("professional")}
              className={`text-left p-4 rounded-xl border transition-all ${
                plan === "professional" ? "border-primary gold-glow bg-primary/5" : "border-input hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">Professional</span>
                {plan === "professional" && <Check className="w-4 h-4 text-primary" />}
              </div>
              <div className="font-heading text-2xl font-bold gold-text mt-1">
                $100<span className="text-sm text-muted-foreground font-body">/year</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Up to 1,000 members</p>
            </button>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Administrator Account</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminName">Your Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="adminName" placeholder="John Doe" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="pl-10 h-11" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email (Login)</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11" required />
            </div>
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium gold-gradient text-black" disabled={loading}>
          {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>) : (<><UserPlus className="w-4 h-4 mr-2" />Register Institution</>)}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          A 6-digit OTP will be sent to your email for verification. Your account will be activated after approval by the platform owner.
        </p>
      </form>
    </AuthLayout>
  );
}