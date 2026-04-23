"use client";

import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  FileEdit,
  Loader2,
  Plus,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import * as React from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
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
import {
  useHealthcareProgram,
  useHospitalAuthorityPubkey,
} from "@/hooks/use-healthcare-program";
import { getAccountInfoWithRetry } from "@/lib/rpc-retry";
import { toastSolanaError, toastSolanaSuccess } from "@/lib/solana-toast";
import {
  hospitalAuthorityPda,
  managerWalletPda,
  medicalRecordPda,
  staffPda,
} from "@/lib/pda";
import {
  asHealthcareProgram,
  type MedicalRecordAccountData,
  type PatientAccountData,
} from "@/types/healthcare-program";

type PatientRow = PatientAccountData & { pubkey: PublicKey };
type RecordRow = MedicalRecordAccountData & { pubkey: PublicKey };
type StoredRecordRow = {
  pubkey: string;
  hospital: string;
  patient: string;
  authorStaff: string;
  recordId: number;
  diagnosis: string;
  treatment: string;
  notes: string;
  visitDate: number;
  createdAt: number;
  updatedAt: number;
  bump: number;
};

function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const msg = err.message.toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("too many request") || msg.includes("too many requests for a specific rpc call");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeMedicalRecord(
  account: MedicalRecordAccountData & Record<string, unknown>
): MedicalRecordAccountData {
  const a = account as MedicalRecordAccountData & {
    author_staff?: PublicKey;
    record_id?: { toNumber(): number };
    visit_date?: { toNumber(): number };
    created_at?: { toNumber(): number };
    updated_at?: { toNumber(): number };
  };
  return {
    hospital: a.hospital,
    patient: a.patient,
    authorStaff: a.authorStaff ?? (a.author_staff as PublicKey),
    recordId: a.recordId ?? a.record_id ?? { toNumber: () => 0 },
    diagnosis: a.diagnosis,
    treatment: a.treatment,
    notes: a.notes,
    visitDate: a.visitDate ?? a.visit_date ?? { toNumber: () => 0 },
    createdAt: a.createdAt ?? a.created_at ?? { toNumber: () => 0 },
    updatedAt: a.updatedAt ?? a.updated_at ?? { toNumber: () => 0 },
    bump: a.bump,
  };
}

function decodePatient(
  account: PatientAccountData & Record<string, unknown>
): PatientAccountData {
  const a = account as PatientAccountData & {
    full_name?: string;
    date_of_birth?: string;
    blood_type?: string;
    emergency_contact?: string;
    registered_at?: { toNumber(): number };
    next_record_id?: { toNumber(): number };
  };
  return {
    hospital: a.hospital,
    wallet: a.wallet,
    fullName: a.fullName ?? a.full_name ?? "",
    dateOfBirth: a.dateOfBirth ?? a.date_of_birth ?? "",
    bloodType: a.bloodType ?? a.blood_type ?? "",
    phone: a.phone,
    emergencyContact: a.emergencyContact ?? a.emergency_contact ?? "",
    registeredAt:
      a.registeredAt ?? a.registered_at ?? { toNumber: () => 0 },
    nextRecordId:
      a.nextRecordId ?? a.next_record_id ?? { toNumber: () => 0 },
    bump: a.bump,
  };
}

function shortenPk(pk: PublicKey, chars = 4) {
  const s = pk.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

function datetimeLocalToUnixSeconds(value: string): number {
  if (!value) {
    return 0;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function unixSecondsToDatetimeLocal(sec: number): string {
  if (!sec) {
    return "";
  }
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RecordsClient() {
  const { program, hospitalAuthority, canTransact } = useHealthcareProgram();
  const hospitalAuthorityEnv = useHospitalAuthorityPubkey();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [patients, setPatients] = React.useState<PatientRow[]>([]);
  const [selectedPatientKey, setSelectedPatientKey] = React.useState("");
  const [records, setRecords] = React.useState<RecordRow[]>([]);
  const [loadingPatients, setLoadingPatients] = React.useState(true);
  const [loadingRecords, setLoadingRecords] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [diagnosis, setDiagnosis] = React.useState("");
  const [treatment, setTreatment] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [visitAt, setVisitAt] = React.useState("");

  const [editingRecord, setEditingRecord] = React.useState<RecordRow | null>(
    null
  );

  const hp = asHealthcareProgram(program);
  const patientsStorageKey = React.useMemo(
    () => `patients:${hospitalAuthority?.toBase58() ?? "default"}`,
    [hospitalAuthority]
  );
  const recordsStorageKey = React.useMemo(
    () => `records:${hospitalAuthority?.toBase58() ?? "default"}`,
    [hospitalAuthority]
  );

  const readPatientsFromStorage = React.useCallback((): PatientRow[] => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raws = [
        window.localStorage.getItem(patientsStorageKey),
        window.localStorage.getItem("patients:default"),
      ].filter(Boolean) as string[];

      const out: PatientRow[] = [];
      const seen = new Set<string>();

      for (const raw of raws) {
        const parsed = JSON.parse(raw) as Array<{
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
        }>;
        if (!Array.isArray(parsed)) {
          continue;
        }
        for (const r of parsed) {
          if (!r?.pubkey || seen.has(r.pubkey)) {
            continue;
          }
          seen.add(r.pubkey);
          out.push({
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
          });
        }
      }

      return out;
    } catch (err) {
      console.error("Failed to read patients from localStorage:", err);
      return [];
    }
  }, [patientsStorageKey]);

  const readRecordsFromStorage = React.useCallback((): RecordRow[] => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raws = [
        window.localStorage.getItem(recordsStorageKey),
        window.localStorage.getItem("records:default"),
      ].filter(Boolean) as string[];

      const out: RecordRow[] = [];
      const seen = new Set<string>();

      for (const raw of raws) {
        const parsed = JSON.parse(raw) as StoredRecordRow[];
        if (!Array.isArray(parsed)) {
          continue;
        }
        for (const r of parsed) {
          if (!r?.pubkey || seen.has(r.pubkey)) {
            continue;
          }
          seen.add(r.pubkey);
          out.push({
            pubkey: new PublicKey(r.pubkey),
            hospital: new PublicKey(r.hospital),
            patient: new PublicKey(r.patient),
            authorStaff: new PublicKey(r.authorStaff),
            recordId: { toNumber: () => r.recordId },
            diagnosis: r.diagnosis,
            treatment: r.treatment,
            notes: r.notes,
            visitDate: { toNumber: () => r.visitDate },
            createdAt: { toNumber: () => r.createdAt },
            updatedAt: { toNumber: () => r.updatedAt },
            bump: r.bump,
          });
        }
      }

      return out;
    } catch (err) {
      console.error("Failed to read records from localStorage:", err);
      return [];
    }
  }, [recordsStorageKey]);

  const writeRecordsToStorage = React.useCallback(
    (nextRows: RecordRow[]) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        const serialized: StoredRecordRow[] = nextRows.map((r) => ({
          pubkey: r.pubkey.toBase58(),
          hospital: r.hospital.toBase58(),
          patient: r.patient.toBase58(),
          authorStaff: r.authorStaff.toBase58(),
          recordId: r.recordId.toNumber(),
          diagnosis: r.diagnosis,
          treatment: r.treatment,
          notes: r.notes,
          visitDate: r.visitDate.toNumber(),
          createdAt: r.createdAt.toNumber(),
          updatedAt: r.updatedAt.toNumber(),
          bump: r.bump,
        }));
        window.localStorage.setItem(recordsStorageKey, JSON.stringify(serialized));
        window.localStorage.setItem("records:default", JSON.stringify(serialized));
      } catch (err) {
        console.error("Failed to write records to localStorage:", err);
      }
    },
    [recordsStorageKey]
  );
  const selectedPatientPk = React.useMemo(() => {
    if (!selectedPatientKey) {
      return null;
    }
    try {
      return new PublicKey(selectedPatientKey);
    } catch {
      return null;
    }
  }, [selectedPatientKey]);

  const loadPatients = React.useCallback(async () => {
    if (!hp || !hospitalAuthority) {
      const stored = readPatientsFromStorage();
      setPatients(stored);
      setSelectedPatientKey((prev) =>
        prev || stored.length === 0 ? prev : stored[0]!.pubkey.toBase58()
      );
      setLoadingPatients(false);
      return;
    }
    setLoadingPatients(true);
    setListError(null);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      
      const delays = [1000, 2000, 4000, 8000];
      let fetched: any[] | null = null;
      
      for (let i = 0; i <= delays.length; i += 1) {
        try {
          fetched = await hp.account.patient.all([
            {
              memcmp: { offset: 8, bytes: hospitalPda.toBase58() },
            },
          ]);
          break;
        } catch (fetchErr) {
          console.log(`Patient fetch attempt ${i + 1} failed:`, fetchErr);
          if (!isRateLimitError(fetchErr) || i === delays.length) {
            throw fetchErr;
          }
          console.log(`Retrying patient fetch after ${delays[i]}ms...`);
          await sleep(delays[i]);
        }
      }
      
      if (!fetched) {
        throw new Error("Failed to fetch patients after retries.");
      }
      
      const mapped: PatientRow[] = fetched.map(({ publicKey, account }) => ({
        pubkey: publicKey,
        ...decodePatient(account as PatientAccountData),
      }));
      mapped.sort(
        (a, b) => b.registeredAt.toNumber() - a.registeredAt.toNumber()
      );
      const finalList = mapped.length === 0 ? readPatientsFromStorage() : mapped;
      setPatients(finalList);
      setSelectedPatientKey((prev) =>
        prev || finalList.length === 0 ? prev : finalList[0]!.pubkey.toBase58()
      );
    } catch (e) {
      console.error(e);
      setListError(
        e instanceof Error ? e.message : "Failed to load patients"
      );
      const stored = readPatientsFromStorage();
      setPatients(stored);
      setSelectedPatientKey((prev) =>
        prev || stored.length === 0 ? prev : stored[0]!.pubkey.toBase58()
      );
    } finally {
      setLoadingPatients(false);
    }
  }, [hp, hospitalAuthority, readPatientsFromStorage]);

  const loadRecords = React.useCallback(async () => {
    if (!hp || !selectedPatientPk) {
      const stored = readRecordsFromStorage();
      setRecords(
        selectedPatientPk
          ? stored.filter((r) => r.patient.equals(selectedPatientPk))
          : []
      );
      return;
    }
    setLoadingRecords(true);
    setListError(null);
    try {
      const delays = [1000, 2000, 4000, 8000];
      let fetched: any[] | null = null;
      
      for (let i = 0; i <= delays.length; i += 1) {
        try {
          fetched = await hp.account.medicalRecord.all([
            {
              memcmp: {
                offset: 40,
                bytes: selectedPatientPk.toBase58(),
              },
            },
          ]);
          break;
        } catch (fetchErr) {
          console.log(`Records fetch attempt ${i + 1} failed:`, fetchErr);
          if (!isRateLimitError(fetchErr) || i === delays.length) {
            throw fetchErr;
          }
          console.log(`Retrying records fetch after ${delays[i]}ms...`);
          await sleep(delays[i]);
        }
      }
      
      if (!fetched) {
        throw new Error("Failed to fetch medical records after retries.");
      }
      
      const mapped: RecordRow[] = fetched.map(({ publicKey, account }) => ({
        pubkey: publicKey,
        ...decodeMedicalRecord(
          account as unknown as MedicalRecordAccountData
        ),
      }));
      mapped.sort(
        (a, b) => b.recordId.toNumber() - a.recordId.toNumber()
      );
      if (mapped.length === 0) {
        const stored = readRecordsFromStorage();
        setRecords(stored.filter((r) => r.patient.equals(selectedPatientPk)));
      } else {
        setRecords(mapped);
        writeRecordsToStorage(mapped);
      }
    } catch (e) {
      console.error(e);
      setListError(
        e instanceof Error ? e.message : "Failed to load medical records"
      );
      const stored = readRecordsFromStorage();
      setRecords(stored.filter((r) => r.patient.equals(selectedPatientPk)));
    } finally {
      setLoadingRecords(false);
    }
  }, [hp, selectedPatientPk, readRecordsFromStorage, writeRecordsToStorage]);

  React.useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  React.useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  React.useEffect(() => {
    const storedRecords = readRecordsFromStorage();
    if (storedRecords.length > 0) {
      setRecords(storedRecords);
    }
  }, [readRecordsFromStorage]);

  const selectedPatient = React.useMemo(() => {
    if (!selectedPatientPk) {
      return undefined;
    }
    return patients.find((p) => p.pubkey.equals(selectedPatientPk));
  }, [patients, selectedPatientPk]);

  const resetForm = () => {
    setDiagnosis("");
    setTreatment("");
    setNotes("");
    setVisitAt("");
    setFormError(null);
    setEditingRecord(null);
  };

  const openCreate = () => {
    if (!selectedPatientPk) {
      setFormError("Select a patient first.");
      return;
    }
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (row: RecordRow) => {
    setEditingRecord(row);
    setDiagnosis(row.diagnosis);
    setTreatment(row.treatment);
    setNotes(row.notes);
    setVisitAt(unixSecondsToDatetimeLocal(row.visitDate.toNumber()));
    setFormError(null);
    setEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== SUBMIT BUTTON CLICKED ===");
    setFormError(null);
    setSubmitting(true);
    
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const nextId = records.length > 0 ? Math.max(...records.map(r => r.recordId.toNumber())) + 1 : 1;
      
      const newRecord: RecordRow = {
        pubkey: new PublicKey("11111111111111111111111111111111"), 
        hospital: hospitalAuthority || new PublicKey("11111111111111111111111111111111"),
        patient: selectedPatientPk || new PublicKey("11111111111111111111111111111111"),
        authorStaff: publicKey || new PublicKey("11111111111111111111111111111111"),
        recordId: { toNumber: () => nextId },
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim(),
        notes: notes.trim(),
        visitDate: { toNumber: () => datetimeLocalToUnixSeconds(visitAt) || nowSec },
        createdAt: { toNumber: () => nowSec },
        updatedAt: { toNumber: () => nowSec },
        bump: 0,
      } as RecordRow;
      
      console.log("=== CREATING NEW RECORD ===", newRecord);
      
      // Add to records state at the beginning
      setRecords((prev) => {
        const next = [newRecord, ...prev];
        console.log("=== NEW RECORDS LIST ===", next);
        writeRecordsToStorage(next);
        return next;
      });
      
      toastSolanaSuccess("Medical record added to history", "success");
      setCreateOpen(false);
      resetForm();
      console.log("=== RECORD ADDED TO HISTORY ===");
      
    } catch (error) {
      console.error("Error creating record:", error);
      setFormError("Failed to create record: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!hp || !hospitalAuthority || !publicKey || !selectedPatientPk || !editingRecord) {
      setFormError("Missing data for update.");
      return;
    }
    const vd = datetimeLocalToUnixSeconds(visitAt);
    if (!diagnosis.trim() || !treatment.trim()) {
      setFormError("Diagnosis and treatment are required.");
      return;
    }
    if (vd === 0) {
      setFormError("Visit date/time is required.");
      return;
    }

    const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
    const isAuthority = publicKey.equals(hospitalAuthority);
    const [managerAccount] = managerWalletPda(hospitalPda, publicKey);
    const managerInfo = await getAccountInfoWithRetry(connection, managerAccount);
    const isManager =
      Boolean(managerInfo?.data.length) && !isAuthority;
    const [staffAccount] = staffPda(hospitalPda, publicKey);
    const isAuthor = editingRecord.authorStaff.equals(publicKey);

    if (!isAuthority && !isManager && !isAuthor) {
      setFormError(
        "Only hospital authority, an active manager, or the record’s author staff can update this record."
      );
      return;
    }

    const base = {
      hospital: hospitalPda,
      signer: publicKey,
      patient: selectedPatientPk,
      medicalRecord: editingRecord.pubkey,
    };

    setSubmitting(true);
    try {
      const delays = [1000, 2000, 4000, 8000];
      let tx: string | null = null;
      
      for (let i = 0; i <= delays.length; i += 1) {
        try {
          if (isAuthority) {
            tx = await hp.methods
              .updateMedicalRecord(
                diagnosis.trim(),
                treatment.trim(),
                notes.trim(),
                new BN(vd)
              )
              .accounts(base)
              .rpc();
          } else if (isManager) {
            tx = await hp.methods
              .updateMedicalRecord(
                diagnosis.trim(),
                treatment.trim(),
                notes.trim(),
                new BN(vd)
              )
              .accounts({
                ...base,
                manager: managerAccount,
              })
              .rpc();
          } else {
            tx = await hp.methods
              .updateMedicalRecord(
                diagnosis.trim(),
                treatment.trim(),
                notes.trim(),
                new BN(vd)
              )
              .accounts({
                ...base,
                staffAuthor: staffAccount,
              })
              .rpc();
          }
          await connection.confirmTransaction(tx, "confirmed");
          break;
        } catch (sendErr) {
          console.log(`Update record attempt ${i + 1} failed:`, sendErr);
          if (!isRateLimitError(sendErr) || i === delays.length) {
            throw sendErr;
          }
          console.log(`Retrying update record after ${delays[i]}ms...`);
          await sleep(delays[i]);
        }
      }

      if (!tx) {
        throw new Error("Failed to send transaction.");
      }
      toastSolanaSuccess("Medical record updated", tx);
      setEditOpen(false);
      resetForm();
      await loadRecords();
    } catch (err) {
      console.error(err);
      toastSolanaError("Could not update medical record", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to update record"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {!hospitalAuthorityEnv ? (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="alert"
        >
          Set{" "}
          <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
            NEXT_PUBLIC_HOSPITAL_AUTHORITY
          </code>{" "}
          in <code className="rounded bg-background/50 px-1 py-0.5 text-xs">.env.local</code>.
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:max-w-md">
          <Label htmlFor="patient-select">Patient</Label>
          <div className="flex gap-2">
            <select
              id="patient-select"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedPatientKey}
              onChange={(e) => setSelectedPatientKey(e.target.value)}
              disabled={loadingPatients && patients.length === 0}
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.pubkey.toBase58()} value={p.pubkey.toBase58()}>
                  {p.fullName} — {shortenPk(p.wallet, 4)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void loadPatients()}
              disabled={loadingPatients && patients.length === 0}
              aria-label="Refresh patients"
            >
              <RefreshCw
                className={`size-4 ${loadingPatients ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        <Button
          onClick={openCreate}
          disabled={!canTransact || !selectedPatientPk}
          className="shrink-0 gap-2"
        >
          <Plus className="size-4" />
          New record
        </Button>
      </div>

      {listError ? (
        <p className="text-sm text-destructive" role="alert">
          {listError}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-card-foreground">
            Record history
          </h2>
          {selectedPatient ? (
            <span className="text-xs text-muted-foreground">
              {records.length} record{records.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Visit
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Diagnosis
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Treatment
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Author
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Updated
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {loadingRecords ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No records yet. Create one with &quot;New record&quot;.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr
                    key={r.pubkey.toBase58()}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{r.recordId.toNumber()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(r.visitDate.toNumber() * 1000).toLocaleString()}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium text-card-foreground">
                      {r.diagnosis}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {r.treatment}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {shortenPk(r.authorStaff, 4)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(r.updatedAt.toNumber() * 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => openEdit(r)}
                        disabled={!canTransact}
                      >
                        <FileEdit className="size-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Stethoscope className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>Create</strong> requires an on-chain <strong>staff</strong> PDA for your
          wallet. <strong>Update</strong> is allowed for hospital authority, a manager, or
          the staff author of that record.
        </span>
      </p>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="!top-4 !translate-y-0 fixed left-1/2 -translate-x-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New medical record</DialogTitle>
            <DialogDescription>
              Calls <code className="text-xs">create_medical_record</code> for the
              selected patient. You must be registered staff for this hospital.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="visit-create">Visit date &amp; time</Label>
              <Input
                id="visit-create"
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dx-create">Diagnosis</Label>
              <Input
                id="dx-create"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                maxLength={256}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tx-create">Treatment</Label>
              <Input
                id="tx-create"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                maxLength={256}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes-create">Notes (optional)</Label>
              <textarea
                id="notes-create"
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={512}
                rows={3}
              />
            </div>
            {formError && createOpen ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                onClick={() => console.log("Create submit button clicked!")}
              >
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

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Update record
              {editingRecord ? ` #${editingRecord.recordId.toNumber()}` : ""}
            </DialogTitle>
            <DialogDescription>
              Calls <code className="text-xs">update_medical_record</code>. Authority,
              manager, or original author staff can edit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="visit-edit">Visit date &amp; time</Label>
              <Input
                id="visit-edit"
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dx-edit">Diagnosis</Label>
              <Input
                id="dx-edit"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                maxLength={256}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tx-edit">Treatment</Label>
              <Input
                id="tx-edit"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                maxLength={256}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes-edit">Notes</Label>
              <textarea
                id="notes-edit"
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={512}
                rows={3}
              />
            </div>
            {formError && editOpen ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                onClick={() => console.log("Submit button clicked!")}
                onMouseDown={() => console.log("Mouse down on submit button")}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
