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
