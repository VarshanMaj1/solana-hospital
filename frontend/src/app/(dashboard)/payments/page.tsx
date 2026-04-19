import type { Metadata } from "next";
import { PaymentsClient } from "./payments-client";

export const metadata: Metadata = {
  title: "Payments | HealthCare",
  description: "Create payments linked to medical records and browse Solana activity",
};

export default function PaymentsPage() {
  return <PaymentsClient />;
}
