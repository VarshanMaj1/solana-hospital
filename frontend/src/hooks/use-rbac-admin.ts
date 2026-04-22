"use client";

import * as React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

export function useIsAdmin(): boolean {
  const { publicKey } = useWallet();

  const adminPk = React.useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.trim();
    if (!raw) {
      return null;
    }
    try {
      return new PublicKey(raw);
    } catch {
      return null;
    }
  }, []);

  return Boolean(publicKey && adminPk && publicKey.equals(adminPk));
}

