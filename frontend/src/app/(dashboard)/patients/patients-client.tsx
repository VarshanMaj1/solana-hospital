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
import { hospitalAuthorityPda, managerWalletPda, patientPda } from "@/lib/pda";
import { getAccountInfoWithRetry } from "@/lib/rpc-retry";
import { toastSolanaError, toastSolanaSuccess } from "@/lib/solana-toast";
import {
  asHealthcareProgram,
  type PatientAccountData,
} from "@/types/healthcare-program";

const BLOOD_FILTERS = [
  "All",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Other",
] as const;

type PatientRow = PatientAccountData & { pubkey: PublicKey };
type StoredPatientRow = {
  pubkey: string;
  hospital: string;
  wallet: string;
  fullName: string;
  dateOfBirth: string;
  bloodType: string;
  phone: string;
  emergencyContact: string;
  registeredAt: number;
  nextRecordId: number;
  bump: number;
};

function shortenPk(pk: PublicKey, chars = 4) {
  const s = pk.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

export function PatientsClient() {
  const { program, wallet, hospitalAuthority, canTransact } = useHealthcareProgram();
  const hospitalAuthorityFromEnv = useHospitalAuthorityPubkey();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [rows, setRows] = React.useState<PatientRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [bloodFilter, setBloodFilter] =
    React.useState<(typeof BLOOD_FILTERS)[number]>("All");

  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [patientWalletStr, setPatientWalletStr] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [bloodType, setBloodType] = React.useState("O+");
  const [phone, setPhone] = React.useState("");
  const [emergencyContact, setEmergencyContact] = React.useState("");
  const lastLoadKeyRef = React.useRef<string | null>(null);
  const storageKey = React.useMemo(
    () => `patients:${hospitalAuthority?.toBase58() ?? "default"}`,
    [hospitalAuthority]
  );

  const readPatientsFromStorage = React.useCallback((): PatientRow[] => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as StoredPatientRow[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((r) => ({
        pubkey: new PublicKey(r.pubkey),
        hospital: new PublicKey(r.hospital),
        wallet: new PublicKey(r.wallet),
        fullName: r.fullName,
        dateOfBirth: r.dateOfBirth,
        bloodType: r.bloodType,
        phone: r.phone,
        emergencyContact: r.emergencyContact,
        registeredAt: { toNumber: () => r.registeredAt },
        nextRecordId: { toNumber: () => r.nextRecordId },
        bump: r.bump,
      }));
    } catch (err) {
      console.error("Failed to read patients from localStorage:", err);
      return [];
    }
  }, [storageKey]);

  const writePatientsToStorage = React.useCallback(
    (nextRows: PatientRow[]) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        const serialized: StoredPatientRow[] = nextRows.map((r) => ({
          pubkey: r.pubkey.toBase58(),
          hospital: r.hospital.toBase58(),
          wallet: r.wallet.toBase58(),
          fullName: r.fullName,
          dateOfBirth: r.dateOfBirth,
          bloodType: r.bloodType,
          phone: r.phone,
          emergencyContact: r.emergencyContact,
          registeredAt: r.registeredAt.toNumber(),
          nextRecordId: r.nextRecordId.toNumber(),
          bump: r.bump,
        }));
        window.localStorage.setItem(storageKey, JSON.stringify(serialized));
      } catch (err) {
        console.error("Failed to write patients to localStorage:", err);
      }
    },
    [storageKey]
  );

  const loadPatients = React.useCallback(async () => {
    const hp = asHealthcareProgram(program);
    if (!hp || !hospitalAuthority) {
      setRows(readPatientsFromStorage());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const fetched = await hp.account.patient.all([
        {
          memcmp: {
            offset: 8,
            bytes: hospitalPda.toBase58(),
          },
        },
      ]);

      const mapped: PatientRow[] = fetched.map(({ publicKey, account }) => {
        const a = account as PatientAccountData & {
          full_name?: string;
          date_of_birth?: string;
          blood_type?: string;
          emergency_contact?: string;
          registered_at?: { toNumber(): number };
          next_record_id?: { toNumber(): number };
        };
        return {
          pubkey: publicKey,
          hospital: a.hospital,
          wallet: a.wallet,
          fullName: a.fullName ?? a.full_name ?? "",
          dateOfBirth: a.dateOfBirth ?? a.date_of_birth ?? "",
          bloodType: a.bloodType ?? a.blood_type ?? "",
          phone: a.phone,
          emergencyContact: a.emergencyContact ?? a.emergency_contact ?? "",
          registeredAt:
            a.registeredAt ??
            a.registered_at ?? { toNumber: () => 0 },
          nextRecordId:
            a.nextRecordId ??
            a.next_record_id ?? { toNumber: () => 0 },
          bump: a.bump,
        };
      });
      mapped.sort((x, y) => y.registeredAt.toNumber() - x.registeredAt.toNumber());
      if (mapped.length === 0) {
        setRows(readPatientsFromStorage());
      } else {
        setRows(mapped);
        writePatientsToStorage(mapped);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load patients");
      setRows(readPatientsFromStorage());
    } finally {
      setLoading(false);
    }
  }, [program, hospitalAuthority, readPatientsFromStorage, writePatientsToStorage]);

  React.useEffect(() => {
    const key = `${program ? "ready" : "none"}:${hospitalAuthority?.toBase58() ?? "none"}`;
    if (lastLoadKeyRef.current === key) {
      return;
    }
    lastLoadKeyRef.current = key;
    void loadPatients();
  }, [program, hospitalAuthority, loadPatients]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (bloodFilter !== "All" && r.bloodType !== bloodFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.wallet.toBase58().toLowerCase().includes(q) ||
        r.emergencyContact.toLowerCase().includes(q)
      );
    });
  }, [rows, search, bloodFilter]);

  const resetForm = () => {
    setPatientWalletStr("");
    setFullName("");
    setDateOfBirth("");
    setBloodType("O+");
    setPhone("");
    setEmergencyContact("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      if (!program || !hospitalAuthority || !publicKey) {
        setFormError("Connect a wallet and configure hospital authority.");
        return;
      }

      let patientWalletPk: PublicKey;
      try {
        patientWalletPk = new PublicKey(patientWalletStr.trim());
      } catch {
        setFormError("Invalid patient wallet address.");
        return;
      }

      if (
        !fullName.trim() ||
        !dateOfBirth.trim() ||
        !bloodType.trim() ||
        !phone.trim() ||
        !emergencyContact.trim()
      ) {
        setFormError("All fields are required.");
        return;
      }

      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const [patientAccount] = patientPda(hospitalPda, patientWalletPk);
      const existing = await getAccountInfoWithRetry(connection, patientAccount);
      if (existing) {
        setFormError("A patient is already registered for this wallet.");
        return;
      }

      const isAuthority = publicKey.equals(hospitalAuthority);
      const [managerAccount] = managerWalletPda(hospitalPda, publicKey);
      const managerInfo = isAuthority
        ? null
        : await getAccountInfoWithRetry(connection, managerAccount);
      const isManager =
        managerInfo !== null &&
        managerInfo.data.length > 0 &&
        !isAuthority;

      if (!isAuthority && !isManager) {
        setFormError(
          "Your wallet must be the hospital authority or a registered manager."
        );
        return;
      }

      const hp = asHealthcareProgram(program);
      if (!hp) {
        setFormError("Program not ready.");
        return;
      }
      const deployedProgram = await getAccountInfoWithRetry(connection, hp.programId);
      if (!deployedProgram) {
        const nowSec = Math.floor(Date.now() / 1000);
        const mockRow: PatientRow = {
          pubkey: patientAccount,
          hospital: hospitalPda,
          wallet: patientWalletPk,
          fullName: fullName.trim(),
          dateOfBirth: dateOfBirth.trim(),
          bloodType: bloodType.trim(),
          phone: phone.trim(),
          emergencyContact: emergencyContact.trim(),
          registeredAt: { toNumber: () => nowSec },
          nextRecordId: { toNumber: () => 0 },
          bump: 0,
        };
        setRows((prev) => {
          const next = [mockRow, ...prev];
          writePatientsToStorage(next);
          return next;
        });
        setModalOpen(false);
        resetForm();
        setFormError(
          "Program is not deployed on the current network. Added a temporary local mock patient."
        );
        return;
      }

      const base = {
        hospital: hospitalPda,
        admin: publicKey,
        patientWallet: patientWalletPk,
        patient: patientAccount,
        systemProgram: SystemProgram.programId,
      };

      const tx = await hp.methods
        .registerPatient(
          fullName.trim(),
          dateOfBirth.trim(),
          bloodType.trim(),
          phone.trim(),
          emergencyContact.trim()
        )
        .accounts({
          ...base,
          // Explicitly pass null for optional account when authority signs.
          manager: isAuthority ? null : managerAccount,
        } as unknown as Record<string, PublicKey>)
        .rpc();

      await connection.confirmTransaction(tx, "confirmed");
      toastSolanaSuccess("Patient registered", tx);
      const nowSec = Math.floor(Date.now() / 1000);
      const localRow: PatientRow = {
        pubkey: patientAccount,
        hospital: hospitalPda,
        wallet: patientWalletPk,
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        bloodType: bloodType.trim(),
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim(),
        registeredAt: { toNumber: () => nowSec },
        nextRecordId: { toNumber: () => 0 },
        bump: 0,
      };
      setRows((prev) => {
        const deduped = prev.filter((r) => !r.pubkey.equals(localRow.pubkey));
        const next = [localRow, ...deduped];
        writePatientsToStorage(next);
        return next;
      });
      setModalOpen(false);
      resetForm();
      await loadPatients();
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
      toastSolanaError("Could not register patient", err);
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
          to the public key that created the hospital (same as{" "}
          <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
            register_hospital
          </code>{" "}
          signer). Then restart the dev server.
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, wallet…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search patients"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="blood-filter" className="sr-only">
              Blood type
            </Label>
            <select
              id="blood-filter"
              value={bloodFilter}
              onChange={(e) =>
                setBloodFilter(e.target.value as (typeof BLOOD_FILTERS)[number])
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {BLOOD_FILTERS.map((b) => (
                <option key={b} value={b}>
                  Blood: {b}
                </option>
              ))}
            </select>
          </div>
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
          Add patient
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
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Patient wallet
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  DOB
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Blood
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Phone
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Emergency
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Registered
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
                    No patients match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.pubkey.toBase58()}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      {r.fullName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {shortenPk(r.wallet, 5)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.dateOfBirth}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {r.bloodType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone}</td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground">
                      {r.emergencyContact}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(r.registeredAt.toNumber() * 1000).toLocaleString()}
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
            <DialogTitle>Register patient</DialogTitle>
            <DialogDescription>
              Creates an on-chain patient account via{" "}
              <code className="text-xs">register_patient</code>. You must be the
              hospital authority or an active manager.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="patient-wallet">Patient wallet (Solana)</Label>
              <Input
                id="patient-wallet"
                placeholder="Patient's public key"
                value={patientWalletStr}
                onChange={(e) => setPatientWalletStr(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={64}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                placeholder="YYYY-MM-DD"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                maxLength={16}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blood">Blood type</Label>
              <select
                id="blood"
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {BLOOD_FILTERS.filter((b) => b !== "All").map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={24}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emergency">Emergency contact</Label>
              <Input
                id="emergency"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                maxLength={64}
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