import type { Metadata } from "next";
import { MedicinesClient } from "./medicines-client";

export const metadata: Metadata = {
  title: "Medicines | HealthCare",
  description: "Medicine inventory on Solana",
};

export default function MedicinesPage() {
  return <MedicinesClient />;
}
