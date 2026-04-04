"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
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
    title: "Staff",
    description: "Doctors, nurses, and hospital staff.",
  },
  "/records": {
    title: "Medical records",
    description: "Clinical visits, diagnoses, and notes.",
  },
  "/medicines": {
    title: "Medicines",
    description: "Inventory, SKUs, and stock levels.",
  },
  "/payments": {
    title: "Payments",
    description: "Billing, settlements, and treasury.",
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
  const pathname = usePathname();
  const { title, description } = resolveHeader(pathname);

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
        <ThemeToggle />
        <WalletMultiButton className="!h-9 !rounded-md !bg-primary !font-medium !text-primary-foreground hover:!bg-primary/90" />
      </div>
    </header>
  );
}
