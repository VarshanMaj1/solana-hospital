"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { DEFAULT_CLUSTER, getRpcEndpoint } from "@/lib/anchor";

import "@solana/wallet-adapter-react-ui/styles.css";

type Props = {
  children: React.ReactNode;
};

/**
 * Client-only Solana + wallet modal context. Wrap the app (e.g. in `layout.tsx`).
 * Wallets: Phantom, Solflare, Backpack.
 */
export function SolanaWalletProvider({ children }: Props) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);
  const network = useMemo(
    () =>
      DEFAULT_CLUSTER === "mainnet-beta"
        ? WalletAdapterNetwork.Mainnet
        : DEFAULT_CLUSTER === "testnet"
          ? WalletAdapterNetwork.Testnet
          : WalletAdapterNetwork.Devnet,
    []
  );

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new BackpackWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
