import type { Metadata } from "next";
import { RecordsClient } from "./records-client";

export const metadata: Metadata = {
  title: "Medical records | HealthCare",
  description: "View and manage on-chain medical records",
};

export default function RecordsPage() {
  return <RecordsClient />;
}
