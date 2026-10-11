import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, LogOut, Loader2 } from "lucide-react";
import { backend } from "@/api/backendClient";
import { isPlatformAdmin } from "@/lib/roles";

export default function PendingApproval() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const me = await backend.auth.me();
        // Platform admin always has access
        if (isPlatformAdmin(me)) {
          window.location.href = "/dashboard";
          return;
        }
        // Approved users go to dashboard
        if (me.account_status === "approved") {
          window.location.href = "/dashboard";
          return;
        }
        setUser(me);
        // Fetch institution details if linked
        if (me.institution_id) {
          try {
            const inst = await backend.entities.Institution.get(me.institution_id);
            setInstitution(inst);
            // Self-heal: institution approved by the owner but the user's status
            // was never synced — grant admin portal access now.
            if (inst.status === "approved" && me.account_status !== "approved") {
              await backend.auth.updateMe({ account_status: "approved" });
              window.location.href = "/dashboard";
              return;
            }
          } catch {}
        }
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [navigate]);

  const handleLogout = async () => {
    await backend.auth.logout(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = user?.account_status || (institution?.status) || "pending";
  const reason = institution?.admin_reason;
  const config = {
    pending: {
      icon: Clock,
      title: "Registration Pending Approval",
      message: `Hello ${user?.full_name || user?.email}, your institution "${institution?.name || user?.institution_name || ""}" registration has been received and is awaiting approval from the platform owner. You will be notified once your account is activated.`,
      color: "text-primary",
    },
    rejected: {
      icon: XCircle,
      title: "Registration Rejected",
      message: reason
        ? `Your institution registration was not approved. Reason: ${reason}`
        : "Your institution registration was not approved. Please contact the platform owner for more information.",
      color: "text-destructive",
    },
  };
  const cfg = config[status] || config.pending;
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full luxury-card rounded-2xl p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/20 border border-border flex items-center justify-center mx-auto mb-6">
          <Icon className={`w-8 h-8 ${cfg.color}`} />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-3">{cfg.title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">{cfg.message}</p>
        <div className="space-y-3">
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
          <Link to="/" className="block text-sm text-muted-foreground hover:text-foreground transition">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}