import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@coral-xyz/anchor",
    "@solana/buffer-layout",
    "@solana/web3.js",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
    "@solana/wallet-adapter-backpack",
  ],
  // Next.js 16 defaults to Turbopack; keep an explicit empty config when not using custom webpack.
  turbopack: {},
};

export default nextConfig;
