import type { Metadata } from "next";
import { PatientsClient } from "./patients-client";

export const metadata: Metadata = {
  title: "Patients | HealthCare",
  description: "Register and manage patients on Solana",
};

export default function PatientsPage() {
  return <PatientsClient />;
}
