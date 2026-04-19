import type { PublicKey } from "@solana/web3.js";
import { DEFAULT_CLUSTER } from "@/lib/anchor";

function clusterQuery(): string {
  if (DEFAULT_CLUSTER === "mainnet-beta") {
    return "";
  }
  return `?cluster=${encodeURIComponent(DEFAULT_CLUSTER)}`;
}

/** Solana Explorer URL for a transaction signature. */
export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${clusterQuery()}`;
}

/** Solana Explorer URL for an account address. */
export function explorerAddressUrl(address: PublicKey): string {
  return `https://explorer.solana.com/address/${address.toBase58()}${clusterQuery()}`;
}
