import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { canAccessModule, roleLabel, isPlatformAdmin } from "@/lib/roles";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Banknote,
  Upload,
  LogOut,
  ExternalLink,
  ClipboardList,
  Calendar,
  Smartphone,
  Calculator,
  HandCoins,
  Landmark,
  UserCog,
  ShieldCheck,
  KeyRound,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const allNavItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { label: "Members", path: "/members", icon: Users, module: "members" },
  { label: "Shares", path: "/shares", icon: TrendingUp, module: "shares" },
  { label: "Dividends", path: "/dividends", icon: HandCoins, module: "dividends" },
  { label: "Loans Summary", path: "/loans", icon: Banknote, module: "loans" },
  { label: "Applications", path: "/applications", icon: ClipboardList, module: "applications" },
  { label: "Repayments", path: "/repayments", icon: Calendar, module: "repayments" },
  { label: "Payments", path: "/payments", icon: Smartphone, module: "payments" },
  { label: "Banking", path: "/banking", icon: Landmark, module: "banking" },
  { label: "Accounting", path: "/accounting", icon: Calculator, module: "accounting" },
  { label: "Upload Loans", path: "/upload-loans", icon: Upload, module: "upload-loans" },
  { label: "User Management", path: "/users", icon: UserCog, module: "users", roles: ["institution_admin"] },
  { label: "Owner Dashboard", path: "/owner", icon: ShieldCheck, platformAdminOnly: true },
  { label: "Account Settings", path: "/account", icon: KeyRound, alwaysVisible: true },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    backend.auth.me().then(async (u) => {
      setCurrentUser(u);
      if (u && !isPlatformAdmin(u)) {
        try {
          const insts = await backend.entities.Institution.list();
          const mine =
            insts.find((i) => i.admin_user_id === u.id) ||
            insts.find((i) => i.status === "approved") ||
            null;
          setInstitution(mine);
        } catch {}
      }
    }).catch(() => {});
  }, []);

  const role = currentUser?.role || "";
  const platformAdmin = isPlatformAdmin(currentUser);
  const navItems = allNavItems.filter((item) => {
    if (item.platformAdminOnly) return platformAdmin;
    if (item.alwaysVisible) return true;
    if (platformAdmin) return false;
    if (item.roles) return item.roles.includes(role);
    return canAccessModule(role, item.module);
  });

  const handleLogout = async () => {
    await backend.auth.logout("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl sunset-card-gradient flex items-center justify-center">
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="font-heading font-semibold gold-text text-base">Veritas</h1>
            <p className="text-[10px] text-sidebar-foreground/60 font-mono">{roleLabel(role)}</p>
          </div>
        </Link>
      </div>

      {/* Institution name */}
      {institution && (
        <div className="px-5 py-4 border-b border-sidebar-border">
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 mb-1">Institution</p>
          <p
            className="gold-text leading-tight"
            style={{ fontFamily: "'Monotype Corsiva', 'Brush Script MT', cursive", textTransform: "uppercase", fontSize: "1.6rem", letterSpacing: "0.02em" }}
          >
            {institution.name}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent transition-all"
        >
          <ExternalLink className="w-4 h-4" /> Member Portal
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 sunset-gradient border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full sunset-gradient border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 sunset-gradient border-b border-sidebar-border h-14 flex items-center justify-between px-4">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-sidebar-accent">
            <Menu className="w-5 h-5 text-sidebar-foreground" />
          </button>
          <span className="font-heading font-semibold gold-text">Veritas</span>
          <Link to="/account" className="p-2">
            <KeyRound className="w-5 h-5 text-sidebar-foreground/70" />
          </Link>
        </div>
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}