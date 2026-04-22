"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/config/nav";
import { useIsAdmin } from "@/hooks/use-rbac-admin";
import { cn } from "@/lib/utils";

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();

  const items = dashboardNav
    .filter((item) => {
      if (isAdmin) {
        return true;
      }
      return item.href !== "/patients" && item.href !== "/staff";
    })
    .map((item) => {
      if (isAdmin) {
        return item;
      }
      if (item.href === "/") {
        return { ...item, label: "My Health Portal" };
      }
      if (item.href === "/records") {
        return { ...item, label: "Medical History" };
      }
      if (item.href === "/medicines") {
        return { ...item, label: "Prescriptions" };
      }
      if (item.href === "/payments") {
        return { ...item, label: "Billing & Invoices" };
      }
      return item;
    });

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
