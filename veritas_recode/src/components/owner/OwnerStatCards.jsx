import React from "react";
import { Building2, Clock, CheckCircle2, PauseCircle, AlertTriangle, Users, CalendarClock } from "lucide-react";
import { licenseStatus, isExpiringSoon } from "@/lib/ownerUtils";

export default function OwnerStatCards({ institutions, users }) {
  const total = institutions.length;
  const pending = institutions.filter((i) => i.status === "pending").length;
  const active = institutions.filter((i) => licenseStatus(i).key === "active").length;
  const suspended = institutions.filter((i) => i.status === "suspended").length;
  const expired = institutions.filter((i) => licenseStatus(i).key === "expired").length;
  const totalUsers = users.length;
  const expiringSoon = institutions.filter((i) => isExpiringSoon(i)).length;

  const cards = [
    { label: "Total Institutions", value: total, icon: Building2, tone: "text-primary" },
    { label: "Pending Applications", value: pending, icon: Clock, tone: "text-blue-400" },
    { label: "Active Institutions", value: active, icon: CheckCircle2, tone: "text-emerald-400" },
    { label: "Suspended", value: suspended, icon: PauseCircle, tone: "text-amber-400" },
    { label: "Expired", value: expired, icon: AlertTriangle, tone: "text-rose-400" },
    { label: "Total Users", value: totalUsers, icon: Users, tone: "text-primary" },
    { label: "Approaching Expiry", value: expiringSoon, icon: CalendarClock, tone: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="luxury-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase text-muted-foreground tracking-wide">{c.label}</span>
              <Icon className={`w-4 h-4 ${c.tone}`} />
            </div>
            <div className="font-heading text-3xl font-bold">{c.value}</div>
          </div>
        );
      })}
    </div>
  );
}