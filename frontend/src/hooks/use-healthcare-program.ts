"use client";

import type { Wallet } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { createAnchorProvider, getHealthcareProgram } from "@/lib/anchor";

export function useHospitalAuthorityPubkey(): PublicKey | null {
  const raw = process.env.NEXT_PUBLIC_HOSPITAL_AUTHORITY?.trim();
  if (!raw) {
    return null;
  }
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

export function useHealthcareProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const hospitalAuthority = useHospitalAuthorityPubkey();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return null;
    }

    // Some wallet adapters expose `signTransaction` but not `signAllTransactions`.
    // Anchor expects both, so we provide a safe fallback.
    const anchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions:
        wallet.signAllTransactions ??
        (async (txs) => Promise.all(txs.map((tx) => wallet.signTransaction!(tx)))),
    } as unknown as Wallet;

    return createAnchorProvider(connection, anchorWallet);
  }, [
    connection,
    wallet.publicKey,
    wallet.signAllTransactions,
    wallet.signTransaction,
  ]);

  const program = useMemo(() => {
    if (!provider) {
      return null;
    }
    return getHealthcareProgram(provider);
  }, [provider]);

  return {
    program,
    provider,
    connection,
    wallet,
    hospitalAuthority,
    canTransact: Boolean(program && hospitalAuthority && wallet.publicKey),
  };
}
