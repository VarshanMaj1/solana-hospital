import type { Metadata } from "next";
import { StaffClient } from "./staff-client";

export const metadata: Metadata = {
  title: "Staff | HealthCare",
  description: "Add and view doctors, nurses, and staff on Solana",
};

export default function StaffPage() {
  return <StaffClient />;
}
