import type { BN, Idl, Program } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

/** Anchor-encoded `StaffRole` for instruction args. */
export type StaffRoleArg =
  | { doctor: Record<string, never> }
  | { nurse: Record<string, never> }
  | { other: Record<string, never> };

/** Decoded `Hospital` account. */
export type HospitalAccountData = {
  authority: PublicKey;
  name: string;
  location: string;
  registrationNumber: string;
  phone: string;
  isActive: boolean;
  createdAt: { toNumber(): number };
  bump: number;
  nextMedicineId: { toNumber(): number };
  nextPaymentId: { toNumber(): number };
};

/** Decoded `Patient` account (Anchor camelCases IDL fields). */
export type PatientAccountData = {
  hospital: PublicKey;
  wallet: PublicKey;
  fullName: string;
  dateOfBirth: string;
  bloodType: string;
  phone: string;
  emergencyContact: string;
  registeredAt: { toNumber(): number };
  nextRecordId: { toNumber(): number };
  bump: number;
};

/** Decoded `Staff` account. */
export type StaffAccountData = {
  hospital: PublicKey;
  wallet: PublicKey;
  role: StaffRoleArg | Record<string, unknown>;
  department: string;
  licenseNumber: string;
  isActive: boolean;
  registeredAt: { toNumber(): number };
  bump: number;
};

/** Decoded `Manager` account. */
export type ManagerAccountData = {
  hospital: PublicKey;
  wallet: PublicKey;
  isActive: boolean;
  appointedAt: { toNumber(): number };
  bump: number;
};

/** Decoded `Medicine` account. */
export type MedicineAccountData = {
  hospital: PublicKey;
  medicineId: { toNumber(): number };
  name: string;
  sku: string;
  stockQuantity: number;
  unitPriceLamports: { toNumber(): number } | bigint | number;
  requiresPrescription: boolean;
  bump: number;
};

/** Decoded `MedicalRecord` account. */
export type MedicalRecordAccountData = {
  hospital: PublicKey;
  patient: PublicKey;
  authorStaff: PublicKey;
  recordId: { toNumber(): number };
  diagnosis: string;
  treatment: string;
  notes: string;
  visitDate: { toNumber(): number };
  createdAt: { toNumber(): number };
  updatedAt: { toNumber(): number };
  bump: number;
};

/** Decoded `Payment` account. */
export type PaymentAccountData = {
  hospital: PublicKey;
  patient: PublicKey;
  medicalRecord: PublicKey | null;
  medicine: PublicKey | null;
  paymentId: { toNumber(): number };
  amountLamports: { toString(): string } | bigint | number;
  status: PaymentStatusDecoded;
  description: string;
  createdAt: { toNumber(): number };
  bump: number;
};

/** Anchor enum shape for `PaymentStatus`. */
export type PaymentStatusDecoded = Record<string, unknown>;

type MemcmpFilter = { memcmp: { offset: number; bytes: string } };

export type HealthcareProgram = Program<Idl> & {
  account: {
    hospital: {
      fetch: (address: PublicKey) => Promise<HospitalAccountData>;
    };
    patient: {
      fetch: (address: PublicKey) => Promise<PatientAccountData>;
      all: (
        filters?: MemcmpFilter[]
      ) => Promise<
        Array<{ publicKey: PublicKey; account: PatientAccountData }>
      >;
    };
    staff: {
      fetch: (address: PublicKey) => Promise<StaffAccountData>;
      all: (
        filters?: MemcmpFilter[]
      ) => Promise<
        Array<{ publicKey: PublicKey; account: StaffAccountData }>
      >;
    };
    manager: {
      fetch: (address: PublicKey) => Promise<ManagerAccountData>;
    };
    medicine: {
      all: (
        filters?: MemcmpFilter[]
      ) => Promise<
        Array<{ publicKey: PublicKey; account: MedicineAccountData }>
      >;
    };
    medicalRecord: {
      all: (
        filters?: MemcmpFilter[]
      ) => Promise<
        Array<{ publicKey: PublicKey; account: MedicalRecordAccountData }>
      >;
    };
    payment: {
      all: (
        filters?: MemcmpFilter[]
      ) => Promise<
        Array<{ publicKey: PublicKey; account: PaymentAccountData }>
      >;
    };
  };
  methods: {
    registerPatient: (
      fullName: string,
      dateOfBirth: string,
      bloodType: string,
      phone: string,
      emergencyContact: string
    ) => {
      accounts: (a: Record<string, PublicKey>) => { rpc: () => Promise<string> };
    };
    addStaff: (
      role: StaffRoleArg,
      department: string,
      licenseNumber: string
    ) => {
      accounts: (a: Record<string, PublicKey>) => { rpc: () => Promise<string> };
    };
    addMedicine: (
      name: string,
      sku: string,
      initialStock: number,
      unitPriceLamports: BN | number,
      requiresPrescription: boolean
    ) => {
      accounts: (a: Record<string, PublicKey>) => { rpc: () => Promise<string> };
    };
    createMedicalRecord: (
      diagnosis: string,
      treatment: string,
      notes: string,
      visitDate: BN | number
    ) => {
      accounts: (a: Record<string, PublicKey>) => { rpc: () => Promise<string> };
    };
    updateMedicalRecord: (
      diagnosis: string,
      treatment: string,
      notes: string,
      visitDate: BN | number
    ) => {
      accounts: (a: Record<string, PublicKey>) => { rpc: () => Promise<string> };
    };
    createPayment: (amountLamports: BN | number, description: string) => {
      accounts: (a: Record<string, PublicKey>) => { rpc: () => Promise<string> };
    };
  };
};

export function asHealthcareProgram(
  program: Program<Idl> | null
): HealthcareProgram | null {
  if (!program) {
    return null;
  }
  return program as unknown as HealthcareProgram;
}

export function staffRoleLabel(
  role: StaffAccountData["role"]
): "Doctor" | "Nurse" | "Other" {
  if (role && typeof role === "object") {
    if ("doctor" in role) {
      return "Doctor";
    }
    if ("nurse" in role) {
      return "Nurse";
    }
    if ("other" in role) {
      return "Other";
    }
  }
  return "Other";
}

export function paymentStatusLabel(
  status: PaymentStatusDecoded
): "Pending" | "Completed" | "Refunded" | "Cancelled" {
  if (status && typeof status === "object") {
    if ("pending" in status) {
      return "Pending";
    }
    if ("completed" in status) {
      return "Completed";
    }
    if ("refunded" in status) {
      return "Refunded";
    }
    if ("cancelled" in status) {
      return "Cancelled";
    }
  }
  return "Pending";
}
