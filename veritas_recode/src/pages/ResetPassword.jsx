import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backend, supabase } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prepare = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setReady(!!session);
        if (!session) setError("This password reset link is invalid or has expired.");
      } catch (e) {
        setError(e.message || "Could not validate the reset link");
      } finally {
        setLoading(false);
      }
    };
    prepare();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      await backend.auth.resetPassword({ newPassword });
      await backend.auth.logout(false);
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AuthLayout icon={Lock} title="Checking reset link"><div className="py-6 text-center">Loading...</div></AuthLayout>;

  if (!ready) {
    return <AuthLayout icon={AlertTriangle} title="Invalid reset link" subtitle="This password reset link is missing, expired or invalid" footer={<Link to="/forgot-password" className="text-primary font-medium hover:underline">Request a new link</Link>}><p className="text-sm text-destructive text-center">{error}</p></AuthLayout>;
  }

  return (
    <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="password">New Password</Label><Input id="password" type="password" autoComplete="new-password" autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="confirm">Confirm Password</Label><Input id="confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting...</> : "Reset password"}</Button>
      </form>
    </AuthLayout>
  );
}
