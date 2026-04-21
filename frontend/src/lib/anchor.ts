import {
  AnchorProvider,
  Program,
  setProvider,
  type Idl,
  type Wallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  type Commitment,
} from "@solana/web3.js";

import healthcareIdl from "@/idl/healthcare.json";

/** Default devnet RPC when `NEXT_PUBLIC_SOLANA_RPC_URL` is unset. */
export const DEFAULT_CLUSTER: "devnet" | "mainnet-beta" | "testnet" =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as typeof DEFAULT_CLUSTER) ||
  "devnet";

export function getRpcEndpoint(): string {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (url) {
    return url;
  }
  return clusterApiUrl(DEFAULT_CLUSTER);
}

export function getConnection(commitment: Commitment = "confirmed") {
  return new Connection(getRpcEndpoint(), commitment);
}

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "6FyZincSKRMEJkiFxB3bHkP1rJJnEMoGf3FUCqs8tKgK"
);

export type HealthcareIdl = typeof healthcareIdl;

function getValidatedHealthcareIdl(): Idl {
  const maybeModule = healthcareIdl as unknown as { default?: unknown };
  const idlValue =
    maybeModule &&
    typeof maybeModule === "object" &&
    "default" in maybeModule &&
    maybeModule.default
      ? maybeModule.default
      : healthcareIdl;

  if (!idlValue || typeof idlValue !== "object") {
    throw new Error("Invalid healthcare IDL: import did not resolve to an object.");
  }

  const candidate = idlValue as {
    instructions?: unknown;
    accounts?: unknown;
  };

  if (!Array.isArray(candidate.instructions) || candidate.instructions.length === 0) {
    throw new Error("Invalid healthcare IDL: missing or empty instructions.");
  }

  if (!Array.isArray(candidate.accounts) || candidate.accounts.length === 0) {
    throw new Error("Invalid healthcare IDL: missing or empty accounts.");
  }

  return idlValue as Idl;
}

/**
 * Build an Anchor provider from a Solana connection and a wallet that implements
 * Anchor’s `Wallet` interface (e.g. `useWallet()` when connected).
 */
export function createAnchorProvider(
  connection: Connection,
  wallet: Wallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

/**
 * Instantiate the healthcare program client. Replace `src/idl/healthcare.json`
 * with the file produced by `anchor idl build` in your program workspace.
 */
export function getHealthcareProgram(provider: AnchorProvider) {
  const idl = getValidatedHealthcareIdl();
  const idlWithAddress = {
    ...idl,
    address: PROGRAM_ID.toBase58(),
  } as Idl;
  return new Program(idlWithAddress, provider);
}
/**
 * Registers the provider with Anchor’s global `getProvider()` (optional).
 * Call when the wallet connects; useful for code that expects a default provider.
 */
export function setAnchorGlobalProvider(provider: AnchorProvider) {
  setProvider(provider);
}
