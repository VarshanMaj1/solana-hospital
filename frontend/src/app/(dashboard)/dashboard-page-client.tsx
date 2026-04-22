"use client";

import {
  Activity,
  CalendarClock,
  CreditCard,
  Droplets,
  Pill,
  DollarSign,
  FileText,
  TrendingUp,
  UserSquare2,
  Users,
} from "lucide-react";
import * as React from "react";
import { useIsAdmin } from "@/hooks/use-rbac-admin";

const countFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function safeCountFromStorage(keys: string[]): number {
  if (typeof window === "undefined") {
    return 0;
  }
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.length;
      }
    } catch {
      // ignore and try next key
    }
  }
  return 0;
}

const patientOverviewCards = [
  {
    label: "Next Appointment",
    value: "Oct 24",
    hint: "Placeholder",
    icon: CalendarClock,
  },
  {
    label: "Blood Type",
    value: "O+",
    hint: "Placeholder",
    icon: Droplets,
  },
  {
    label: "Active Prescriptions",
    value: "2",
    hint: "Placeholder",
    icon: Pill,
  },
  {
    label: "Billing & Invoices",
    value: "—",
    hint: "Placeholder",
    icon: CreditCard,
  },
] as const;

export function DashboardPageClient() {
  const isAdmin = useIsAdmin();
  const [counts, setCounts] = React.useState(() => ({
    patients: 0,
    staff: 0,
    records: 0,
  }));

  React.useEffect(() => {
    const hospitalAuthority = process.env.NEXT_PUBLIC_HOSPITAL_AUTHORITY?.trim();
    const suffix = hospitalAuthority || "default";

    const read = () => {
      setCounts({
        patients: safeCountFromStorage([`patients:${suffix}`, "patients:default"]),
        staff: safeCountFromStorage([`staff:${suffix}`, "staff:default"]),
        records: safeCountFromStorage([`records:${suffix}`, "records:default"]),
      });
    };

    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  const adminOverviewCards = React.useMemo(
    () => [
      {
        label: "Total patients",
        value: countFormatter.format(counts.patients),
        hint: "Count from app data",
        icon: Users,
      },
      {
        label: "Total staff",
        value: countFormatter.format(counts.staff),
        hint: "Count from app data",
        icon: UserSquare2,
      },
      {
        label: "Total records",
        value: countFormatter.format(counts.records),
        hint: "Count from app data",
        icon: FileText,
      },
      {
        label: "Total revenue",
        value: currencyFormatter.format(0),
        hint: "Placeholder",
        icon: DollarSign,
      },
    ],
    [counts.patients, counts.records, counts.staff]
  );

  const overviewCards = isAdmin ? adminOverviewCards : patientOverviewCards;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
              Welcome back
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Use the sidebar to manage patients, staff, records, inventory, and
              payments. Connect your wallet in the header to submit transactions.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            <Activity className="size-4" aria-hidden />
            Devnet ready
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5" aria-hidden />
            Placeholder metrics
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map(({ label, value, hint, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4 text-foreground" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-card-foreground">
                {value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-card-foreground">Recent activity</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Transaction history and record updates will appear here once your app
            fetches on-chain events.
          </p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2 rounded-md border border-dashed border-border px-3 py-2">
              <span className="text-foreground/50">—</span>
              No events yet
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-card-foreground">Quick actions</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Wire these buttons to Anchor instructions when you are ready.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Register patient", "Add staff", "New record", "Create payment"].map(
              (a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {a}
                </button>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

