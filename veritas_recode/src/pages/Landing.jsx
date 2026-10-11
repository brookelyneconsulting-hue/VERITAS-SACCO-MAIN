import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isPlatformAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Banknote, Shield, Users, TrendingUp, Calculator, Smartphone,
  Check, ArrowRight, Building2, Lock, Zap, Globe, Star, ChevronRight, LogIn
} from "lucide-react";

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const isSignedIn = isAuthenticated && user;
  const navigate = useNavigate();

  // After a successful login we arrive here with a `next` param; route the user
  // to their console client-side (avoids deep-link 404s on the published app).
  // Normal visits to "/" (no `next`) always show the public website.
  useEffect(() => {
    if (!isSignedIn) return;
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/")) {
      navigate(next, { replace: true });
    }
  }, [isSignedIn, navigate]);

  const features = [
    { icon: Users, title: "Member Management", desc: "Onboard members, track profiles, and manage subscriptions with ease." },
    { icon: TrendingUp, title: "Share Capital", desc: "Record contributions, transfers, and redemptions with full audit trails." },
    { icon: Banknote, title: "Loans & Repayments", desc: "Process loan applications, generate repayment schedules, track balances." },
    { icon: Calculator, title: "Accounting Suite", desc: "Chart of accounts, journal entries, trial balance, financial statements." },
    { icon: Smartphone, title: "M-Pesa Payments", desc: "Approve loan repayments and share contributions with bulk processing." },
    { icon: Shield, title: "Role-Based Access", desc: "Super admin, admin, accountant, and front office with isolated data." },
  ];

  const steps = [
    { icon: Building2, title: "Register", desc: "Sign up your institution in minutes with OTP verification." },
    { icon: Lock, title: "Get Approved", desc: "The platform owner reviews and approves your registration." },
    { icon: Users, title: "Assign Roles", desc: "Invite your accountant and front office team with scoped access." },
    { icon: Zap, title: "Start Operating", desc: "Manage members, loans, shares, and full accounting workflows." },
  ];

  const pricing = [
    {
      name: "Veritas Plan",
      price: "$50",
      period: "/year",
      desc: "Everything you need to run your institution",
      features: ["Up to 15 members", "Member management", "Shares & contributions", "Loans, repayments & guarantors", "M-Pesa payments", "Full accounting suite", "Email support"],
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass-dark border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center">
              <Banknote className="w-5 h-5 text-black" />
            </div>
            <span className="font-heading font-bold text-xl gold-text">Veritas</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">Features</a>
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground transition">How it Works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Link to={isPlatformAdmin(user) ? "/owner" : "/dashboard"}>
                <Button size="sm" className="gold-gradient text-black font-semibold">
                  <ArrowRight className="w-4 h-4 mr-1" /> Go to Console
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm"><LogIn className="w-4 h-4 mr-1" />Institution Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="gold-gradient text-black font-semibold">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark border border-border/50 mb-8">
            <Star className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">World-class financial management for SACCOs</span>
          </div>
          <h1 className="font-heading text-4xl lg:text-6xl font-bold mb-6 leading-tight">
            Veritas
            <span className="gold-text block">Sacco Management System</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            The complete financial hub for savings & lending institutions — manage members, share capital,
            loans, repayments, and full accounting in one elegant, secure platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link to="/register">
              <Button size="lg" className="gold-gradient text-black font-semibold text-base h-14 px-10">
                Register Your Institution
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-base h-14 px-10">
                <LogIn className="w-4 h-4 mr-2" /> Institution Sign In
              </Button>
            </Link>
            <Link to="/portal">
              <Button size="lg" variant="ghost" className="text-base h-14 px-10 text-muted-foreground">
                Member Portal
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> No setup fees</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> OTP-secured</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Data-isolated per institution</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl lg:text-5xl font-bold mb-4">
              Everything your institution needs
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A unified platform covering every financial workflow — from member onboarding to audited financial statements.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="luxury-card rounded-2xl p-6 hover:gold-glow transition-all">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SACCO community band */}
      <section className="relative overflow-hidden border-t border-border/30">
        <img
          src="https://media.backend.com/images/public/6a4a9605454acc55f149160e/9ac9f7488_generated_image.png"
          alt="A community savings group meeting"
          className="w-full h-72 lg:h-96 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/55 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="max-w-lg">
              <h2 className="font-heading text-3xl lg:text-4xl font-bold mb-3">
                Built for the way <span className="gold-text">communities save</span>
              </h2>
              <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                From village chamas to established SACCOs — Veritas brings professional,
                audited financial management to the groups that power local savings and lending.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how" className="py-20 border-t border-border/30 sunset-gradient">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl lg:text-5xl font-bold mb-4">
              Get started in 4 simple steps
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From registration to full operation in minutes — not weeks.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative">
                  <div className="luxury-card rounded-2xl p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center">
                        <Icon className="w-5 h-5 text-black" />
                      </div>
                      <span className="text-3xl font-heading font-bold text-primary/30">{i + 1}</span>
                    </div>
                    <h3 className="font-heading text-lg font-semibold mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 border-t border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl lg:text-5xl font-bold mb-4">
              Simple, affordable pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your institution. Billed annually, no hidden fees.
            </p>
          </div>
          <div className="grid max-w-md mx-auto gap-6">
            {pricing.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  p.popular
                    ? "luxury-card gold-border gold-glow scale-[1.02]"
                    : "luxury-card"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gold-gradient text-black text-xs font-bold">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-heading text-2xl font-bold mb-1">{p.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{p.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-heading text-4xl font-bold gold-text">{p.price}</span>
                  <span className="text-muted-foreground text-sm">{p.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button className="w-full" variant={p.popular ? "default" : "outline"} >
                    {p.popular ? "Start Now" : "Get Started"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="luxury-card rounded-3xl p-12 lg:p-16 gold-glow">
            <Globe className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="font-heading text-3xl lg:text-4xl font-bold mb-4">
              Ready to transform your institution?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Join savings and lending institutions managing their finances with Veritas.
            </p>
            <Link to="/register">
              <Button size="lg" className="gold-gradient text-black font-semibold text-base h-14 px-10">
                Register Your Institution
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center">
                <Banknote className="w-4 h-4 text-black" />
              </div>
              <span className="font-heading font-bold text-lg gold-text">Veritas</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Veritas. Built for savings & lending institutions.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link to="/login" className="hover:text-foreground transition">Sign in</Link>
              <Link to="/register" className="hover:text-foreground transition">Register</Link>
              <Link to="/portal" className="hover:text-foreground transition">Member Portal</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}