import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/anchor";

export function hospitalAuthorityPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("hospital"), authority.toBuffer()],
    PROGRAM_ID
  );
}

/** Patient account PDA for `(hospital, patient_wallet)`. */
export function patientPda(
  hospital: PublicKey,
  patientWallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("patient"), hospital.toBuffer(), patientWallet.toBuffer()],
    PROGRAM_ID
  );
}

export function managerWalletPda(
  hospital: PublicKey,
  managerWallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("manager"), hospital.toBuffer(), managerWallet.toBuffer()],
    PROGRAM_ID
  );
}

/** Staff PDA for `(hospital, staff_wallet)`. */
export function staffPda(
  hospital: PublicKey,
  staffWallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("staff"), hospital.toBuffer(), staffWallet.toBuffer()],
    PROGRAM_ID
  );
}

/** Medical record PDA: `record` + patient account + `record_id` (u64 LE). */
export function medicalRecordPda(
  patientAccount: PublicKey,
  recordId: bigint | number
): [PublicKey, number] {
  const id = BigInt(recordId);
  const idBuf = Buffer.allocUnsafe(8);
  idBuf.writeBigUInt64LE(id, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("record"), patientAccount.toBuffer(), idBuf],
    PROGRAM_ID
  );
}

/** Medicine PDA: `medicine` + hospital + `medicine_id` (u64 LE). */
export function medicinePda(
  hospital: PublicKey,
  medicineId: bigint | number
): [PublicKey, number] {
  const idBuf = Buffer.allocUnsafe(8);
  idBuf.writeBigUInt64LE(BigInt(medicineId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("medicine"), hospital.toBuffer(), idBuf],
    PROGRAM_ID
  );
}

/** Payment PDA: `payment` + hospital + `payment_id` (u64 LE). */
export function paymentPda(
  hospital: PublicKey,
  paymentId: bigint | number
): [PublicKey, number] {
  const idBuf = Buffer.allocUnsafe(8);
  idBuf.writeBigUInt64LE(BigInt(paymentId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("payment"), hospital.toBuffer(), idBuf],
    PROGRAM_ID
  );
}
