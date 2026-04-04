import type { Idl, Program } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

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

export type HealthcareProgram = Program<Idl> & {
  account: {
    patient: {
      all: (
        filters?: Array<{ memcmp: { offset: number; bytes: string } }>
      ) => Promise<
        Array<{ publicKey: PublicKey; account: PatientAccountData }>
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
