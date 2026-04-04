import {
  Activity,
  FileText,
  Pill,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const statCards = [
  {
    label: "Active patients",
    value: "—",
    hint: "On-chain count after sync",
    icon: Users,
  },
  {
    label: "Open records",
    value: "—",
    hint: "Medical records this month",
    icon: FileText,
  },
  {
    label: "Medicine SKUs",
    value: "—",
    hint: "Catalog entries",
    icon: Pill,
  },
  {
    label: "Pending payments",
    value: "—",
    hint: "Awaiting patient settlement",
    icon: Wallet,
  },
];

export default function DashboardPage() {
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
            Snapshot
          </h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5" aria-hidden />
            Live data after program integration
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ label, value, hint, icon: Icon }) => (
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
