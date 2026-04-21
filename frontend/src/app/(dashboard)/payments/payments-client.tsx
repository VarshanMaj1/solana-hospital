"use client";

import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react";
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
import { PROGRAM_ID } from "@/lib/anchor";
import { getAccountInfoWithRetry } from "@/lib/rpc-retry";
import { toastSolanaError, toastSolanaSuccess } from "@/lib/solana-toast";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import {
  hospitalAuthorityPda,
  managerWalletPda,
  paymentPda,
  staffPda,
} from "@/lib/pda";
import {
  asHealthcareProgram,
  paymentStatusLabel,
  type MedicalRecordAccountData,
  type MedicineAccountData,
  type PatientAccountData,
  type PaymentAccountData,
  type PaymentStatusDecoded,
} from "@/types/healthcare-program";

type PatientRow = PatientAccountData & { pubkey: PublicKey };
type RecordRow = MedicalRecordAccountData & { pubkey: PublicKey };
type MedicineRow = MedicineAccountData & { pubkey: PublicKey };

type PaymentRow = {
  pubkey: PublicKey;
  hospital: PublicKey;
  patient: PublicKey;
  medicalRecord: PublicKey | null;
  medicine: PublicKey | null;
  paymentId: { toNumber(): number };
  amountLamports: PaymentAccountData["amountLamports"];
  status: PaymentStatusDecoded;
  description: string;
  createdAt: { toNumber(): number };
  bump: number;
  latestTxSig: string | null;
};

function shortenPk(pk: PublicKey, chars = 4) {
  const s = pk.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

function decodePatient(
  account: PatientAccountData & Record<string, unknown>,
  pubkey: PublicKey
): PatientRow {
  const a = account as PatientAccountData & {
    full_name?: string;
    date_of_birth?: string;
    blood_type?: string;
    emergency_contact?: string;
    registered_at?: { toNumber(): number };
    next_record_id?: { toNumber(): number };
  };
  return {
    pubkey,
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

function decodeMedicalRecord(
  account: MedicalRecordAccountData & Record<string, unknown>,
  pubkey: PublicKey
): RecordRow {
  const a = account as MedicalRecordAccountData & {
    author_staff?: PublicKey;
    record_id?: { toNumber(): number };
    visit_date?: { toNumber(): number };
    created_at?: { toNumber(): number };
    updated_at?: { toNumber(): number };
  };
  return {
    pubkey,
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

function decodeMedicine(
  account: MedicineAccountData & Record<string, unknown>,
  pubkey: PublicKey
): MedicineRow {
  const a = account as MedicineAccountData & {
    medicine_id?: { toNumber(): number };
    stock_quantity?: number;
    requires_prescription?: boolean;
  };
  return {
    pubkey,
    hospital: a.hospital,
    medicineId: a.medicineId ?? a.medicine_id ?? { toNumber: () => 0 },
    name: a.name,
    sku: a.sku,
    stockQuantity: a.stockQuantity ?? a.stock_quantity ?? 0,
    unitPriceLamports: a.unitPriceLamports,
    requiresPrescription: a.requiresPrescription ?? a.requires_prescription ?? false,
    bump: a.bump,
  };
}

function decodePayment(
  raw: PaymentAccountData & Record<string, unknown>,
  pubkey: PublicKey
): Omit<PaymentRow, "latestTxSig"> {
  const a = raw as PaymentAccountData & {
    medical_record?: PublicKey | null;
    medicine?: PublicKey | null;
    payment_id?: { toNumber(): number };
    amount_lamports?: PaymentAccountData["amountLamports"];
    created_at?: { toNumber(): number };
  };
  return {
    pubkey,
    hospital: a.hospital,
    patient: a.patient,
    medicalRecord: a.medicalRecord ?? a.medical_record ?? null,
    medicine: a.medicine ?? null,
    paymentId: a.paymentId ?? a.payment_id ?? { toNumber: () => 0 },
    amountLamports: a.amountLamports ?? a.amount_lamports ?? 0,
    status: a.status,
    description: a.description,
    createdAt: a.createdAt ?? a.created_at ?? { toNumber: () => 0 },
    bump: a.bump,
  };
}

function lamportsToString(v: PaymentAccountData["amountLamports"]): string {
  if (typeof v === "bigint") {
    return v.toString();
  }
  if (typeof v === "number") {
    return String(Math.trunc(v));
  }
  if (v && typeof v === "object" && "toString" in v) {
    return (v as { toString(): string }).toString();
  }
  return "0";
}

export function PaymentsClient() {
  const { program, hospitalAuthority, canTransact } = useHealthcareProgram();
  const hospitalAuthorityEnv = useHospitalAuthorityPubkey();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const hp = asHealthcareProgram(program);

  const [patients, setPatients] = React.useState<PatientRow[]>([]);
  const [records, setRecords] = React.useState<RecordRow[]>([]);
  const [medicines, setMedicines] = React.useState<MedicineRow[]>([]);
  const [payments, setPayments] = React.useState<PaymentRow[]>([]);
  const [programSigs, setProgramSigs] = React.useState<
    Array<{ signature: string; slot: number; err: unknown }>
  >([]);

  const [loadingPatients, setLoadingPatients] = React.useState(true);
  const [loadingRecords, setLoadingRecords] = React.useState(false);
  const [loadingMedicines, setLoadingMedicines] = React.useState(false);
  const [loadingPayments, setLoadingPayments] = React.useState(true);
  const [loadingSigs, setLoadingSigs] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [patientKey, setPatientKey] = React.useState("");
  const [recordKey, setRecordKey] = React.useState("");
  const [medicineKey, setMedicineKey] = React.useState("");
  const [amountLamportsStr, setAmountLamportsStr] = React.useState("");
  const [description, setDescription] = React.useState("");

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
        { memcmp: { offset: 8, bytes: hospitalPda.toBase58() } },
      ]);
      const mapped = fetched.map(({ publicKey: pk, account }) =>
        decodePatient(account as PatientAccountData, pk)
      );
      mapped.sort((a, b) => b.registeredAt.toNumber() - a.registeredAt.toNumber());
      setPatients(mapped);
    } catch (e) {
      console.error(e);
      setListError(e instanceof Error ? e.message : "Failed to load patients");
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, [hp, hospitalAuthority]);

  const loadMedicines = React.useCallback(async () => {
    if (!hp || !hospitalAuthority) {
      setMedicines([]);
      setLoadingMedicines(false);
      return;
    }
    setLoadingMedicines(true);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const fetched = await hp.account.medicine.all([
        { memcmp: { offset: 8, bytes: hospitalPda.toBase58() } },
      ]);
      const mapped = fetched.map(({ publicKey: pk, account }) =>
        decodeMedicine(account as MedicineAccountData, pk)
      );
      mapped.sort((a, b) => b.medicineId.toNumber() - a.medicineId.toNumber());
      setMedicines(mapped);
    } catch (e) {
      console.error(e);
      setMedicines([]);
    } finally {
      setLoadingMedicines(false);
    }
  }, [hp, hospitalAuthority]);

  const loadRecordsForPatient = React.useCallback(
    async (patientAccountPk: PublicKey) => {
      if (!hp || !hospitalAuthority) {
        setRecords([]);
        return;
      }
      setLoadingRecords(true);
      try {
        const fetched = await hp.account.medicalRecord.all([
          { memcmp: { offset: 40, bytes: patientAccountPk.toBase58() } },
        ]);
        const mapped = fetched.map(({ publicKey: pk, account }) =>
          decodeMedicalRecord(account as MedicalRecordAccountData, pk)
        );
        mapped.sort((a, b) => b.recordId.toNumber() - a.recordId.toNumber());
        setRecords(mapped);
      } catch (e) {
        console.error(e);
        setRecords([]);
      } finally {
        setLoadingRecords(false);
      }
    },
    [hp, hospitalAuthority]
  );

  const loadPayments = React.useCallback(async () => {
    if (!hp || !hospitalAuthority) {
      setPayments([]);
      setLoadingPayments(false);
      return;
    }
    setLoadingPayments(true);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const fetched = await hp.account.payment.all([
        { memcmp: { offset: 8, bytes: hospitalPda.toBase58() } },
      ]);
      const decoded = fetched.map(({ publicKey: pk, account }) =>
        decodePayment(account as PaymentAccountData, pk)
      );
      decoded.sort((a, b) => b.paymentId.toNumber() - a.paymentId.toNumber());

      const capped = decoded.slice(0, 40);
      const withSigs: PaymentRow[] = await Promise.all(
        capped.map(async (row) => {
          try {
            const sigs = await connection.getSignaturesForAddress(row.pubkey, {
              limit: 1,
            });
            return { ...row, latestTxSig: sigs[0]?.signature ?? null };
          } catch {
            return { ...row, latestTxSig: null };
          }
        })
      );
      if (decoded.length > capped.length) {
        withSigs.push(
          ...decoded.slice(40).map((row) => ({ ...row, latestTxSig: null as string | null }))
        );
      }
      setPayments(withSigs);
    } catch (e) {
      console.error(e);
      setListError((prev) => prev ?? (e instanceof Error ? e.message : "Failed to load payments"));
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, [hp, hospitalAuthority, connection]);

  const loadProgramSignatures = React.useCallback(async () => {
    setLoadingSigs(true);
    try {
      const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, {
        limit: 25,
      });
      setProgramSigs(
        sigs.map((s) => ({
          signature: s.signature,
          slot: s.slot,
          err: s.err,
        }))
      );
    } catch (e) {
      console.error(e);
      setProgramSigs([]);
    } finally {
      setLoadingSigs(false);
    }
  }, [connection]);

  React.useEffect(() => {
    void loadPatients();
    void loadMedicines();
  }, [loadPatients, loadMedicines]);

  React.useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  React.useEffect(() => {
    void loadProgramSignatures();
  }, [loadProgramSignatures]);

  React.useEffect(() => {
    if (!patientKey) {
      setRecords([]);
      setRecordKey("");
      return;
    }
    try {
      const pk = new PublicKey(patientKey);
      void loadRecordsForPatient(pk);
    } catch {
      setRecords([]);
    }
  }, [patientKey, loadRecordsForPatient]);

  const patientByPk = React.useMemo(() => {
    const m = new Map<string, PatientRow>();
    for (const p of patients) {
      m.set(p.pubkey.toBase58(), p);
    }
    return m;
  }, [patients]);

  const resetForm = () => {
    setPatientKey("");
    setRecordKey("");
    setMedicineKey("");
    setAmountLamportsStr("");
    setDescription("");
    setFormError(null);
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!hp || !hospitalAuthority || !publicKey) {
      setFormError("Connect a wallet and configure hospital authority.");
      return;
    }
    if (!patientKey || !recordKey) {
      setFormError("Select a patient and a medical record.");
      return;
    }
    let patientPk: PublicKey;
    let recordPk: PublicKey;
    try {
      patientPk = new PublicKey(patientKey);
      recordPk = new PublicKey(recordKey);
    } catch {
      setFormError("Invalid patient or record selection.");
      return;
    }

    const record = records.find((r) => r.pubkey.equals(recordPk));
    if (!record || !record.patient.equals(patientPk)) {
      setFormError("Selected record does not belong to this patient.");
      return;
    }

    let amountBn: BN;
    try {
      const raw = amountLamportsStr.trim().replace(/_/g, "");
      amountBn = new BN(raw, 10);
      if (amountBn.isNeg() || amountBn.isZero()) {
        throw new Error("invalid");
      }
    } catch {
      setFormError("Amount must be a positive integer (lamports).");
      return;
    }

    if (!description.trim()) {
      setFormError("Description is required on-chain.");
      return;
    }

    const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
    let nextPaymentId: number;
    try {
      const h = await hp.account.hospital.fetch(hospitalPda);
      nextPaymentId = h.nextPaymentId.toNumber();
    } catch {
      setFormError("Could not read hospital account (check RPC / authority).");
      return;
    }

    const [paymentPk] = paymentPda(hospitalPda, nextPaymentId);
    const exists = await getAccountInfoWithRetry(connection, paymentPk);
    if (exists) {
      setFormError("Payment PDA already exists; refresh and retry.");
      return;
    }

    const isAuthority = publicKey.equals(hospitalAuthority);
    const [managerAccount] = managerWalletPda(hospitalPda, publicKey);
    const managerInfo = await getAccountInfoWithRetry(connection, managerAccount);
    const isManager =
      Boolean(managerInfo?.data.length) && !isAuthority;
    const [staffAccount] = staffPda(hospitalPda, publicKey);
    const staffInfo = await getAccountInfoWithRetry(connection, staffAccount);
    const isStaff = Boolean(staffInfo?.data.length) && !isAuthority && !isManager;

    if (!isAuthority && !isManager && !isStaff) {
      setFormError(
        "Signer must be hospital authority, an active manager, or active staff."
      );
      return;
    }

    let medicinePk: PublicKey | null = null;
    if (medicineKey.trim()) {
      try {
        medicinePk = new PublicKey(medicineKey.trim());
      } catch {
        setFormError("Invalid medicine selection.");
        return;
      }
    }

    const baseAccounts: Record<string, PublicKey> = {
      hospital: hospitalPda,
      signer: publicKey,
      patient: patientPk,
      medicalRecord: recordPk,
      payment: paymentPk,
      systemProgram: SystemProgram.programId,
    };
    if (medicinePk) {
      baseAccounts.medicine = medicinePk;
    }

    let accountsArg: Record<string, PublicKey>;
    if (isAuthority) {
      accountsArg = baseAccounts;
    } else if (isManager) {
      accountsArg = { ...baseAccounts, manager: managerAccount };
    } else {
      accountsArg = { ...baseAccounts, staff: staffAccount };
    }

    setSubmitting(true);
    try {
      const tx = await hp.methods
        .createPayment(amountBn, description.trim())
        .accounts(accountsArg)
        .rpc();
      await connection.confirmTransaction(tx, "confirmed");
      toastSolanaSuccess("Payment created", tx);
      setModalOpen(false);
      resetForm();
      await loadPayments();
      await loadProgramSignatures();
    } catch (err) {
      console.error(err);
      toastSolanaError("Could not create payment", err);
      setFormError(
        err instanceof Error ? err.message : "Transaction failed. Check console."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
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

      {listError ? (
        <p className="text-sm text-destructive" role="alert">
          {listError}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Payment ledger</h2>
          <p className="text-sm text-muted-foreground">
            On-chain payments tied to a medical record (and optional medicine line item).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              void loadPayments();
              void loadProgramSignatures();
            }}
            disabled={loadingPayments}
          >
            <RefreshCw
              className={`size-4 ${loadingPayments ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            disabled={!canTransact}
          >
            <Plus className="size-4" />
            Create payment
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Patient</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Record</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Medicine</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Lamports</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Solana</th>
              </tr>
            </thead>
            <tbody>
              {loadingPayments ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No payments yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const pt = patientByPk.get(p.patient.toBase58());
                  const status = paymentStatusLabel(p.status);
                  return (
                    <tr
                      key={p.pubkey.toBase58()}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.paymentId.toNumber()}
                      </td>
                      <td className="px-4 py-3 text-card-foreground">
                        {pt ? pt.fullName : shortenPk(p.patient, 5)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.medicalRecord ? (
                          <span title={p.medicalRecord.toBase58()}>
                            {shortenPk(p.medicalRecord, 4)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.medicine ? shortenPk(p.medicine, 4) : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {lamportsToString(p.amountLamports)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            status === "Completed"
                              ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                              : status === "Pending"
                                ? "rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100"
                                : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {status}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                        {p.description}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(p.createdAt.toNumber() * 1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <a
                            href={explorerAddressUrl(p.pubkey)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Account
                            <ExternalLink className="size-3" />
                          </a>
                          {p.latestTxSig ? (
                            <a
                              href={explorerTxUrl(p.latestTxSig)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Latest tx
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground">Program transaction history</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Recent signatures involving the healthcare program on this RPC (
          {PROGRAM_ID.toBase58().slice(0, 4)}…).
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="max-h-[320px] overflow-y-auto">
            {loadingSigs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : programSigs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No signatures returned.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {programSigs.map((s) => (
                  <li
                    key={s.signature}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <a
                      href={explorerTxUrl(s.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
                    >
                      {s.signature}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      slot {s.slot}
                      {s.err ? (
                        <span className="ml-2 text-destructive">failed</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="!top-4 !translate-y-0 fixed left-1/2 -translate-x-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create payment</DialogTitle>
            <DialogDescription>
              Calls <code className="text-xs">create_payment</code>. Links a charge to an
              existing medical record for the selected patient. Optional medicine account
              for inventory-related billing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePayment} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pay-patient">Patient</Label>
              <select
                id="pay-patient"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={patientKey}
                onChange={(e) => setPatientKey(e.target.value)}
                disabled={loadingPatients}
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.pubkey.toBase58()} value={p.pubkey.toBase58()}>
                    {p.fullName} — {shortenPk(p.wallet, 4)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-record">Medical record</Label>
              <select
                id="pay-record"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={recordKey}
                onChange={(e) => setRecordKey(e.target.value)}
                disabled={!patientKey || loadingRecords}
              >
                <option value="">
                  {loadingRecords ? "Loading records…" : "Select record…"}
                </option>
                {records.map((r) => (
                  <option key={r.pubkey.toBase58()} value={r.pubkey.toBase58()}>
                    #{r.recordId.toNumber()} — {r.diagnosis.slice(0, 48)}
                    {r.diagnosis.length > 48 ? "…" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-med">Medicine (optional)</Label>
              <select
                id="pay-med"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={medicineKey}
                onChange={(e) => setMedicineKey(e.target.value)}
                disabled={loadingMedicines}
              >
                <option value="">None</option>
                {medicines.map((m) => (
                  <option key={m.pubkey.toBase58()} value={m.pubkey.toBase58()}>
                    {m.name} ({m.sku}) #{m.medicineId.toNumber()}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-amt">Amount (lamports)</Label>
              <Input
                id="pay-amt"
                placeholder="e.g. 5000000"
                value={amountLamportsStr}
                onChange={(e) => setAmountLamportsStr(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-desc">Description</Label>
              <Input
                id="pay-desc"
                placeholder="Invoice line / memo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={128}
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
