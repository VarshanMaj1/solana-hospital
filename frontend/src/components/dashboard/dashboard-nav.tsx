"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/config/nav";
import {
  isNavHrefAllowed,
  useWalletHospitalRole,
} from "@/hooks/use-wallet-hospital-role";
import { cn } from "@/lib/utils";

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useWalletHospitalRole();

  const items = dashboardNav.filter((item) => isNavHrefAllowed(role, item.href));

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
