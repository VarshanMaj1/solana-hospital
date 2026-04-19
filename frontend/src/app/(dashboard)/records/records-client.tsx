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
      setPatients([]);
      setLoadingPatients(false);
      return;
    }
    setLoadingPatients(true);
    setListError(null);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const fetched = await hp.account.patient.all([
        {
          memcmp: { offset: 8, bytes: hospitalPda.toBase58() },
        },
      ]);
      const mapped: PatientRow[] = fetched.map(({ publicKey, account }) => ({
        pubkey: publicKey,
        ...decodePatient(account as PatientAccountData),
      }));
      mapped.sort(
        (a, b) => b.registeredAt.toNumber() - a.registeredAt.toNumber()
      );
      setPatients(mapped);
    } catch (e) {
      console.error(e);
      setListError(
        e instanceof Error ? e.message : "Failed to load patients"
      );
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, [hp, hospitalAuthority]);

  const loadRecords = React.useCallback(async () => {
    if (!hp || !selectedPatientPk) {
      setRecords([]);
      return;
    }
    setLoadingRecords(true);
    setListError(null);
    try {
      const fetched = await hp.account.medicalRecord.all([
        {
          memcmp: {
            offset: 40,
            bytes: selectedPatientPk.toBase58(),
          },
        },
      ]);
      const mapped: RecordRow[] = fetched.map(({ publicKey, account }) => ({
        pubkey: publicKey,
        ...decodeMedicalRecord(
          account as unknown as MedicalRecordAccountData
        ),
      }));
      mapped.sort(
        (a, b) => b.recordId.toNumber() - a.recordId.toNumber()
      );
      setRecords(mapped);
    } catch (e) {
      console.error(e);
      setListError(
        e instanceof Error ? e.message : "Failed to load medical records"
      );
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [hp, selectedPatientPk]);

  React.useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  React.useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

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
    setFormError(null);
    if (!hp || !hospitalAuthority || !publicKey || !selectedPatientPk) {
      setFormError("Connect wallet, set hospital authority, and select a patient.");
      return;
    }
    const vd = datetimeLocalToUnixSeconds(visitAt);
    if (!diagnosis.trim() || !treatment.trim()) {
      setFormError("Diagnosis and treatment are required.");
      return;
    }
    if (vd === 0) {
      setFormError("Visit date/time is required (non-zero on-chain).");
      return;
    }

    const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
    const [staffAccount] = staffPda(hospitalPda, publicKey);
    const staffInfo = await connection.getAccountInfo(staffAccount);
    if (!staffInfo?.data.length) {
      setFormError(
        "Your wallet must have an active staff account for this hospital to create records."
      );
      return;
    }

    const patientData = selectedPatient;
    if (!patientData) {
      setFormError("Patient not found.");
      return;
    }
    const nextId = patientData.nextRecordId.toNumber();
    const [newRecordPda] = medicalRecordPda(selectedPatientPk, nextId);

    setSubmitting(true);
    try {
      const tx = await hp.methods
        .createMedicalRecord(
          diagnosis.trim(),
          treatment.trim(),
          notes.trim(),
          new BN(vd)
        )
        .accounts({
          hospital: hospitalPda,
          signer: publicKey,
          staff: staffAccount,
          patient: selectedPatientPk,
          medicalRecord: newRecordPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(tx, "confirmed");
      toastSolanaSuccess("Medical record created", tx);
      setCreateOpen(false);
      resetForm();
      await loadPatients();
      await loadRecords();
    } catch (err) {
      console.error(err);
      toastSolanaError("Could not create medical record", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to create record"
      );
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
    const managerInfo = await connection.getAccountInfo(managerAccount);
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
      let tx: string;
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
              disabled={loadingPatients}
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
              disabled={loadingPatients}
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
              {!selectedPatientPk ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Choose a patient to view their medical records.
                  </td>
                </tr>
              ) : loadingRecords ? (
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
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
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
              <Button type="submit" disabled={submitting}>
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
              <Button type="submit" disabled={submitting}>
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
