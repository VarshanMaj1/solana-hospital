"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Plus, Search } from "lucide-react";
import * as React from "react";
import { PublicKey, SendTransactionError, SystemProgram } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHealthcareProgram, useHospitalAuthorityPubkey } from "@/hooks/use-healthcare-program";
import { getAccountInfoWithRetry } from "@/lib/rpc-retry";
import { toastSolanaError, toastSolanaSuccess } from "@/lib/solana-toast";
import { hospitalAuthorityPda, staffPda } from "@/lib/pda";
import {
  asHealthcareProgram,
  staffRoleLabel,
  type StaffAccountData,
  type StaffRoleArg,
} from "@/types/healthcare-program";

const ROLE_OPTIONS = [
  { value: "doctor", label: "Doctor", arg: { doctor: {} } as StaffRoleArg },
  { value: "nurse", label: "Nurse", arg: { nurse: {} } as StaffRoleArg },
  { value: "other", label: "Other", arg: { other: {} } as StaffRoleArg },
] as const;

type StaffRow = StaffAccountData & { pubkey: PublicKey };
type StoredStaffRow = {
  pubkey: string;
  hospital: string;
  wallet: string;
  role: StaffRoleArg | Record<string, unknown>;
  department: string;
  licenseNumber: string;
  isActive: boolean;
  registeredAt: number;
  bump: number;
};

function shortenPk(pk: PublicKey, chars = 4) {
  const s = pk.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

function normalizeStaffAccount(
  publicKey: PublicKey,
  raw: StaffAccountData & {
    license_number?: string;
    is_active?: boolean;
    registered_at?: { toNumber(): number };
  }
): StaffRow {
  return {
    pubkey: publicKey,
    hospital: raw.hospital,
    wallet: raw.wallet,
    role: raw.role,
    department: raw.department,
    licenseNumber: raw.licenseNumber ?? raw.license_number ?? "",
    isActive: raw.isActive ?? raw.is_active ?? true,
    registeredAt: raw.registeredAt ?? raw.registered_at ?? { toNumber: () => 0 },
    bump: raw.bump,
  };
}

export function StaffClient() {
  const { program, hospitalAuthority, canTransact } = useHealthcareProgram();
  const hospitalAuthorityFromEnv = useHospitalAuthorityPubkey();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [rows, setRows] = React.useState<StaffRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [staffWalletStr, setStaffWalletStr] = React.useState("");
  const [roleKey, setRoleKey] = React.useState<(typeof ROLE_OPTIONS)[number]["value"]>("doctor");
  const [department, setDepartment] = React.useState("");
  const [licenseNumber, setLicenseNumber] = React.useState("");
  const lastLoadKeyRef = React.useRef<string | null>(null);
  const inFlightLoadRef = React.useRef(false);
  const storageKey = React.useMemo(
    () => `staff:${hospitalAuthority?.toBase58() ?? "default"}`,
    [hospitalAuthority]
  );

  const readStaffFromStorage = React.useCallback((): StaffRow[] => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raw =
        window.localStorage.getItem(storageKey) ??
        window.localStorage.getItem("staff:default");
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as StoredStaffRow[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((r) => ({
        pubkey: new PublicKey(r.pubkey),
        hospital: new PublicKey(r.hospital),
        wallet: new PublicKey(r.wallet),
        role: r.role as StaffRoleArg,
        department: r.department,
        licenseNumber: r.licenseNumber,
        isActive: r.isActive,
        registeredAt: { toNumber: () => r.registeredAt },
        bump: r.bump,
      }));
    } catch (err) {
      console.error("Failed to read staff from localStorage:", err);
      return [];
    }
  }, [storageKey]);

  const writeStaffToStorage = React.useCallback(
    (nextRows: StaffRow[]) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        const serialized: StoredStaffRow[] = nextRows.map((r) => ({
          pubkey: r.pubkey.toBase58(),
          hospital: r.hospital.toBase58(),
          wallet: r.wallet.toBase58(),
          role: r.role as StaffRoleArg,
          department: r.department,
          licenseNumber: r.licenseNumber,
          isActive: r.isActive,
          registeredAt: r.registeredAt.toNumber(),
          bump: r.bump,
        }));
        window.localStorage.setItem(storageKey, JSON.stringify(serialized));
        window.localStorage.setItem("staff:default", JSON.stringify(serialized));
      } catch (err) {
        console.error("Failed to write staff to localStorage:", err);
      }
    },
    [storageKey]
  );

  const loadStaff = React.useCallback(async () => {
    if (inFlightLoadRef.current) {
      return;
    }
    inFlightLoadRef.current = true;
    const hp = asHealthcareProgram(program);
    if (!hp || !hospitalAuthority) {
      setRows(readStaffFromStorage());
      setLoading(false);
      inFlightLoadRef.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const fetched = await hp.account.staff.all([
        {
          memcmp: {
            offset: 8,
            bytes: hospitalPda.toBase58(),
          },
        },
      ]);

      const mapped: StaffRow[] = fetched.map(({ publicKey, account }) =>
        normalizeStaffAccount(publicKey, account as StaffAccountData)
      );
      mapped.sort((x, y) => y.registeredAt.toNumber() - x.registeredAt.toNumber());
      if (mapped.length === 0) {
        setRows(readStaffFromStorage());
      } else {
        setRows(mapped);
        writeStaffToStorage(mapped);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load staff");
      setRows(readStaffFromStorage());
    } finally {
      setLoading(false);
      inFlightLoadRef.current = false;
    }
  }, [program, hospitalAuthority, readStaffFromStorage, writeStaffToStorage]);

  React.useEffect(() => {
    const key = `${program ? "ready" : "none"}:${hospitalAuthority?.toBase58() ?? "none"}`;
    if (lastLoadKeyRef.current === key) {
      return;
    }
    lastLoadKeyRef.current = key;
    void loadStaff();
  }, [program, hospitalAuthority, loadStaff]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) {
        return true;
      }
      const role = staffRoleLabel(r.role).toLowerCase();
      return (
        r.department.toLowerCase().includes(q) ||
        r.licenseNumber.toLowerCase().includes(q) ||
        r.wallet.toBase58().toLowerCase().includes(q) ||
        role.includes(q)
      );
    });
  }, [rows, search]);

  const handleDelete = React.useCallback(
    (pubkey: PublicKey) => {
      const ok =
        typeof window === "undefined"
          ? false
          : window.confirm("Delete this staff entry? This cannot be undone.");
      if (!ok) {
        return;
      }
      setRows((prev) => {
        const next = prev.filter((r) => !r.pubkey.equals(pubkey));
        writeStaffToStorage(next);
        return next;
      });
    },
    [writeStaffToStorage]
  );

  const resetForm = () => {
    setStaffWalletStr("");
    setRoleKey("doctor");
    setDepartment("");
    setLicenseNumber("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    setFormError(null);
    if (!program || !hospitalAuthority || !publicKey) {
      setFormError("Connect a wallet and configure hospital authority.");
      return;
    }

    let staffWalletPk: PublicKey;
    try {
      staffWalletPk = new PublicKey(staffWalletStr.trim());
    } catch {
      setFormError("Invalid staff wallet address.");
      return;
    }

    if (!department.trim() || !licenseNumber.trim()) {
      setFormError("Department and license number are required.");
      return;
    }

    const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
    const [staffAccount] = staffPda(hospitalPda, staffWalletPk);
    const existing = await getAccountInfoWithRetry(connection, staffAccount);
    if (existing) {
      setFormError("Staff is already registered for this wallet.");
      return;
    }

    const hp = asHealthcareProgram(program);
    if (!hp) {
      setFormError("Program not ready.");
      return;
    }
    const roleArg = ROLE_OPTIONS.find((o) => o.value === roleKey)?.arg ?? {
      doctor: {},
    };
    const deployedProgram = await getAccountInfoWithRetry(connection, hp.programId);
    if (!deployedProgram) {
      const nowSec = Math.floor(Date.now() / 1000);
      const mockRow: StaffRow = {
        pubkey: staffAccount,
        hospital: hospitalPda,
        wallet: staffWalletPk,
        role: roleArg,
        department: department.trim(),
        licenseNumber: licenseNumber.trim(),
        isActive: true,
        registeredAt: { toNumber: () => nowSec },
        bump: 0,
      };
      setRows((prev) => {
        const next = [mockRow, ...prev];
        writeStaffToStorage(next);
        return next;
      });
      setModalOpen(false);
      resetForm();
      setFormError(
        "Program is not deployed on the current network. Added a temporary local mock staff record."
      );
      return;
    }

    setSubmitting(true);
    try {
      const base = {
        hospital: hospitalPda,
        admin: publicKey,
        staffWallet: staffWalletPk,
        staff: staffAccount,
        systemProgram: SystemProgram.programId,
      };

      const tx = await hp.methods
        .addStaff(roleArg, department.trim(), licenseNumber.trim())
        .accounts({
          ...base,
          manager: publicKey,
        })
        .rpc();

      await connection.confirmTransaction(tx, "confirmed");
      toastSolanaSuccess("Staff member added", tx);
      const nowSec = Math.floor(Date.now() / 1000);
      const localRow: StaffRow = {
        pubkey: staffAccount,
        hospital: hospitalPda,
        wallet: staffWalletPk,
        role: roleArg,
        department: department.trim(),
        licenseNumber: licenseNumber.trim(),
        isActive: true,
        registeredAt: { toNumber: () => nowSec },
        bump: 0,
      };
      setRows((prev) => {
        const deduped = prev.filter((r) => !r.pubkey.equals(localRow.pubkey));
        const next = [localRow, ...deduped];
        writeStaffToStorage(next);
        return next;
      });
      setModalOpen(false);
      resetForm();
      await loadStaff();
    } catch (err) {
      if (err instanceof SendTransactionError) {
        try {
          const logs = await err.getLogs(connection);
          console.error("Solana simulation logs:", logs);
        } catch (logsErr) {
          console.error("Failed to fetch simulation logs:", logsErr);
        }
      }
      console.error(err);
      toastSolanaError("Could not add staff", err);
      setFormError(
        err instanceof Error ? err.message : "Transaction failed. Check console."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {!hospitalAuthorityFromEnv ? (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="alert"
        >
          Set{" "}
          <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
            NEXT_PUBLIC_HOSPITAL_AUTHORITY
          </code>{" "}
          in{" "}
          <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
            .env.local
          </code>{" "}
          to the hospital authority public key, then restart the dev server.
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search department, license, wallet, role…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search staff"
          />
        </div>
        <Button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          disabled={!canTransact}
          className="shrink-0 gap-2"
        >
          <Plus className="size-4" />
          Add staff
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Wallet
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Department
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  License
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Active
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Registered
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No staff match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.pubkey.toBase58()}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {staffRoleLabel(r.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {shortenPk(r.wallet, 5)}
                    </td>
                    <td className="px-4 py-3 text-card-foreground">{r.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.licenseNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.isActive ? "Yes" : "No"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(r.registeredAt.toNumber() * 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleDelete(r.pubkey)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="!top-4 !translate-y-0 fixed left-1/2 -translate-x-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>
              On-chain <code className="text-xs">add_staff</code> for a doctor, nurse,
              or other role. Signer must be hospital authority or manager.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="staff-wallet">Staff wallet (Solana)</Label>
              <Input
                id="staff-wallet"
                placeholder="Staff member public key"
                value={staffWalletStr}
                onChange={(e) => setStaffWalletStr(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-role">Role</Label>
              <select
                id="staff-role"
                value={roleKey}
                onChange={(e) =>
                  setRoleKey(e.target.value as (typeof ROLE_OPTIONS)[number]["value"])
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dept">Department</Label>
              <Input
                id="dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                maxLength={64}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="license">License number</Label>
              <Input
                id="license"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                maxLength={32}
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !canTransact}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit on-chain"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
