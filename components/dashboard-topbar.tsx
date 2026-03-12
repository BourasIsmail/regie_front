"use client";

import React from "react"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Settings,
  History,
  FileText,
  Users,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    label: "Tableau de Bord",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "REGION", "PROV", "BUDGET"],
  },
  {
    label: "Gestion Plafonds",
    href: "/dashboard/plafonds",
    icon: Settings,
    roles: ["ADMIN", "REGION"],
  },
  {
    label: "Historique",
    href: "/dashboard/historique",
    icon: History,
    roles: ["ADMIN", "REGION", "PROV"],
  },
  {
    label: "Ordre d'Imputation",
    href: "/dashboard/ordre-imputation",
    icon: FileText,
    roles: ["ADMIN", "REGION"],
  },
  {
    label: "Utilisateurs",
    href: "/dashboard/users",
    icon: Users,
    roles: ["ADMIN"],
  },
];

export function DashboardTopbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredNav = navItems.filter((item) =>
      user ? item.roles.includes(user.role) : false
  );

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const initials = user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
      <header className="fixed inset-x-0 top-0 z-50 flex h-[70px] items-center justify-between border-b border-border bg-card px-8 shadow-sm backdrop-blur-sm">
        {/* Left: Brand + Nav */}
        <div className="flex items-center gap-10">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A1A44]">
              <span className="text-sm font-bold text-white">GR</span>
            </div>
            <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-[#0A1A44]">
              Gestion des Regies
            </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Cour des Comptes
            </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                  <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                          "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                          active
                              ? "bg-[linear-gradient(135deg,#1A3A8A_0%,#0A1A44_100%)] text-white shadow-[0_4px_12px_rgba(26,58,138,0.2)]"
                              : "text-muted-foreground hover:bg-secondary hover:text-primary"
                      )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {active && (
                        <span className="absolute -bottom-px left-5 right-5 h-0.5 rounded-sm bg-[#D4AF37]" />
                    )}
                  </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#0A1A44_0%,#1A3A8A_100%)] text-sm font-bold text-white shadow-[0_2px_6px_rgba(26,58,138,0.3)]">
              {initials}
            </div>
            <div className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {user?.email}
            </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {user?.role}
            </span>
            </div>
          </div>
          <button
              onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[1.5px] border-destructive text-destructive transition-all hover:-translate-y-0.5 hover:bg-destructive hover:text-white hover:shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
              title="Deconnexion"
              aria-label="Deconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
  );
}
