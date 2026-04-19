"use client";

import { toast } from "sonner";
import { explorerTxUrl } from "@/lib/explorer";

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") {
      return m;
    }
  }
  return "Something went wrong. Check the console for details.";
}

/** Shown after a transaction signature is confirmed on-chain. */
export function toastSolanaSuccess(title: string, signature: string) {
  toast.success(title, {
    description: "Confirmed on Solana.",
    duration: 9000,
    action: {
      label: "View in Explorer",
      onClick: () => {
        window.open(explorerTxUrl(signature), "_blank", "noopener,noreferrer");
      },
    },
  });
}

/** Shown when sending or confirming a transaction fails. */
export function toastSolanaError(title: string, err: unknown) {
  toast.error(title, {
    description: errorMessage(err),
    duration: 12000,
  });
}
