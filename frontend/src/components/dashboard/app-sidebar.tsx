import { Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            HealthCare
          </span>
          <span className="text-xs text-muted-foreground">Solana</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        <DashboardNav />
      </div>
      <Separator />
      <div className="p-4 text-xs text-muted-foreground">
        <p className="font-medium text-sidebar-foreground/90">Demo dashboard</p>
        <p className="mt-1 leading-relaxed">
          Connect a wallet to interact with the on-chain program.
        </p>
      </div>
    </aside>
  );
}
