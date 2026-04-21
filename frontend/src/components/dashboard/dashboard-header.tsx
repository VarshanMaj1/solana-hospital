"use client";

import * as React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { useWalletHospitalRole } from "@/hooks/use-wallet-hospital-role";
import { Separator } from "@/components/ui/separator";

const pageMeta: Record<
  string,
  { title: string; description: string }
> = {
  "/": {
    title: "Dashboard",
    description: "Overview, activity, and hospital metrics.",
  },
  "/patients": {
    title: "Patients",
    description: "Manage patient registrations and profiles.",
  },
  "/staff": {
    title: "Staff management",
    description: "Add and view doctors, nurses, and other staff.",
  },
  "/records": {
    title: "Medical records",
    description: "Clinical visits, diagnoses, and notes.",
  },
  "/medicines": {
    title: "Medicine inventory",
    description: "Add and view medicines, stock, and pricing.",
  },
  "/payments": {
    title: "Payments",
    description: "Charges linked to visits and recent on-chain program activity.",
  },
};

function resolveHeader(pathname: string) {
  if (pageMeta[pathname]) {
    return pageMeta[pathname];
  }
  const prefix = Object.keys(pageMeta)
    .filter((k) => k !== "/")
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k + "/"));
  if (prefix && pageMeta[prefix]) {
    return pageMeta[prefix];
  }
  return pageMeta["/"];
}

export function DashboardHeader() {
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const { title, description } = resolveHeader(pathname);
  const { publicKey } = useWallet();
  const { label: roleLabel, isResolving } = useWalletHospitalRole();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col justify-center md:ml-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div className="flex items-center gap-2">
        {publicKey ? (
          <span
            className="max-w-[6.5rem] truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground sm:max-w-[8.5rem]"
            title="Derived from your wallet vs on-chain hospital PDAs"
          >
            {isResolving ? "Role…" : roleLabel}
          </span>
        ) : null}
        <ThemeToggle />
        {mounted ? (
          <WalletMultiButton className="!h-9 !rounded-md !bg-primary !font-medium !text-primary-foreground hover:!bg-primary/90" />
        ) : (
          <div className="h-9 w-[140px] rounded-md border border-border bg-muted/40" />
        )}
      </div>
    </header>
  );
}
