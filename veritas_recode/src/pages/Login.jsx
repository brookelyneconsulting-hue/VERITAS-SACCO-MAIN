import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Building2, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { isPlatformAdmin } from "@/lib/roles";

export default function Login() {
  const [mode, setMode] = useState("company"); // company | member
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await backend.auth.loginViaEmailPassword(email, password);
      // Route by role: platform owner -> Owner Console, institutions -> dashboard.
      // Go through the root path (deep links 404 on the published app); the Landing
      // page picks up the `next` param and client-side navigates to the console.
      let next = "/dashboard";
      try {
        const me = await backend.auth.me();
        if (isPlatformAdmin(me)) next = "/owner";
      } catch (_) { /* fall back to dashboard */ }
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.href = "/?next=" + encodeURIComponent(returnTo || next);
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={mode === "company" ? Building2 : User}
      title={mode === "company" ? "Institution Sign In" : "Member Sign In"}
      subtitle={mode === "company" ? "Access your institution dashboard" : "Access the member portal"}
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Register</Link>
        </>
      }
    >
      {/* Mode toggle */}
      <div className="flex p-1 rounded-xl bg-muted/30 border border-border/50 mb-6">
        <button
          type="button"
          onClick={() => { setMode("company"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "company" ? "gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" /> Institution
        </button>
        <button
          type="button"
          onClick={() => { setMode("member"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "member" ? "gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-4 h-4" /> Member
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {mode === "company" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium gold-gradient text-black" disabled={loading}>
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</>) : (<><LogIn className="w-4 h-4 mr-2" />Sign In</>)}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center mx-auto mb-4">
              <User className="w-7 h-7 text-black" />
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Members access the portal using their member number. No password required —
              your member number is your key.
            </p>
          </div>
          <Link to="/portal">
            <Button className="w-full h-12 font-medium gold-gradient text-black">
              Go to Member Portal
            </Button>
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}