"use client";

import * as React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useHealthcareProgram,
  useHospitalAuthorityPubkey,
} from "@/hooks/use-healthcare-program";
import { hospitalAuthorityPda, managerWalletPda, patientPda, staffPda } from "@/lib/pda";
import {
  asHealthcareProgram,
  type ManagerAccountData,
  type PatientAccountData,
  type StaffAccountData,
} from "@/types/healthcare-program";

/**
 * Resolved role for the connected wallet against the hospital in
 * `NEXT_PUBLIC_HOSPITAL_AUTHORITY` (PDA seeds).
 *
 * - **admin**: wallet matches hospital authority pubkey.
 * - **manager**: active on-chain `Manager` PDA for this hospital + wallet.
 * - **staff**: active on-chain `Staff` PDA (inactive managers/staff fall through).
 * - **patient**: registered `Patient` PDA for this wallet.
 * - **guest**: not connected, missing env authority, or no matching account.
 */
export type HospitalWalletRole =
  | "admin"
  | "manager"
  | "staff"
  | "patient"
  | "guest";

const PATIENT_NAV_HREFS = new Set(["/", "/records", "/payments"]);

export function hospitalRoleLabel(role: HospitalWalletRole): string {
  switch (role) {
    case "admin":
      return "Hospital admin";
    case "manager":
      return "Manager";
    case "staff":
      return "Staff";
    case "patient":
      return "Patient";
    default:
      return "Guest";
  }
}

/** Whether a sidebar route is shown for this role (patient = limited menu). */
export function isNavHrefAllowed(
  role: HospitalWalletRole,
  href: string
): boolean {
  if (role === "patient") {
    return PATIENT_NAV_HREFS.has(href);
  }
  return true;
}

export function useWalletHospitalRole(): {
  role: HospitalWalletRole;
  /** True while fetching manager/staff/patient accounts after wallet connects. */
  isResolving: boolean;
  /** Short UI label for the current role. */
  label: string;
} {
  const { program } = useHealthcareProgram();
  const hospitalAuthority = useHospitalAuthorityPubkey();
  const { publicKey } = useWallet();

  const [role, setRole] = React.useState<HospitalWalletRole>("guest");
  const [isResolving, setIsResolving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!publicKey || !hospitalAuthority) {
        if (!cancelled) {
          setRole("guest");
          setIsResolving(false);
        }
        return;
      }

      if (publicKey.equals(hospitalAuthority)) {
        if (!cancelled) {
          setRole("admin");
          setIsResolving(false);
        }
        return;
      }

      const hp = asHealthcareProgram(program);
      if (!hp) {
        if (!cancelled) {
          setRole("guest");
          setIsResolving(false);
        }
        return;
      }

      if (!cancelled) {
        setIsResolving(true);
      }

      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const [managerPk] = managerWalletPda(hospitalPda, publicKey);
      const [staffPk] = staffPda(hospitalPda, publicKey);
      const [patientPk] = patientPda(hospitalPda, publicKey);

      const [mgr, stf, pat] = await Promise.all([
        hp.account.manager.fetch(managerPk).catch(() => null),
        hp.account.staff.fetch(staffPk).catch(() => null),
        hp.account.patient.fetch(patientPk).catch(() => null),
      ]);

      if (cancelled) {
        return;
      }

      const mgrA = mgr as ManagerAccountData | null;
      const stfA = stf as StaffAccountData | null;
      const patA = pat as PatientAccountData | null;

      const mgrActive =
        Boolean(mgrA) &&
        (mgrA!.isActive ??
          (mgrA as unknown as { is_active?: boolean }).is_active ??
          false);
      const stfActive =
        Boolean(stfA) &&
        (stfA!.isActive ??
          (stfA as unknown as { is_active?: boolean }).is_active ??
          false);

      let next: HospitalWalletRole = "guest";
      if (mgrActive) {
        next = "manager";
      } else if (stfActive) {
        next = "staff";
      } else if (patA) {
        next = "patient";
      }

      setRole(next);
      setIsResolving(false);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [program, publicKey, hospitalAuthority]);

  return {
    role,
    isResolving,
    label: hospitalRoleLabel(role),
  };
}
