# Healthcare Management System on Solana

A full-stack reference application for running hospital operations on-chain: patient registration, clinical records, staff and inventory, and payments—all anchored to a single Solana program with a modern Next.js dashboard.

---

## Overview

| Layer | Location | Responsibility |
|--------|-----------|------------------|
| **On-chain program** | `program/programs/healthcare` | Anchor program: accounts, PDAs, authorization, and instruction handlers |
| **Web application** | `frontend` | Next.js App Router UI, wallet connection, Anchor client, role-aware navigation |

The frontend uses a checked-in IDL (`frontend/src/idl/healthcare.json`) that should stay in sync with the program you deploy. After changing Rust instructions or account layouts, regenerate or update the IDL before shipping UI changes.

---

## Features

### On-chain (Anchor)

- **Hospital & treasury** — Register a hospital; treasury PDA for settlements  
- **Managers & staff** — Delegate administration; staff roles (e.g. doctor / nurse) with department and license metadata  
- **Patients** — Register patients by wallet; profile fields (name, DOB, blood type, contacts)  
- **Medical records** — Create and update visit records (diagnosis, treatment, notes, visit date) with staff and permission checks  
- **Medicine inventory** — Catalog SKUs, stock, lamport pricing, prescription flags  
- **Payments** — Create charges linked to patients, optional medical record and medicine; pending / completed / refunded / cancelled flows; patient settlement path (`complete_payment`)  

### Web application

- **Dashboard** — Overview metrics (placeholder counts until wired to RPC)  
- **Patients / Staff / Medicines / Records / Payments** — Tables, filters, and modals that call the program where the IDL exposes instructions  
- **Wallet** — Solana Wallet Adapter (Phantom, Backpack, etc.)  
- **Role awareness** — Resolves **hospital admin**, **manager**, **staff**, or **patient** from PDAs vs `NEXT_PUBLIC_HOSPITAL_AUTHORITY`; patient role gets a reduced nav set  
- **Feedback** — Sonner toasts for successful confirmations and failures, with Solana Explorer links for transaction signatures  
- **Theming** — Light / dark / system via `next-themes`  

---

## Tech Stack

| Area | Technologies |
|------|----------------|
| **Blockchain** | Solana, [Anchor](https://www.anchor-lang.com/) 0.3x, Rust |
| **Frontend** | [Next.js](https://nextjs.org/) 16 (App Router), React 19, TypeScript |
| **Solana client** | `@solana/web3.js`, `@coral-xyz/anchor`, Solana Wallet Adapter + React UI |
| **UI** | Tailwind CSS v4, Radix UI primitives, Lucide icons, [Sonner](https://sonner.emilkowal.ski/) |
| **Tooling** | ESLint (Next config), npm (frontend), Yarn (Anchor workspace per `Anchor.toml`) |

---

## Prerequisites

- **Node.js** 20+ (recommended) and npm  
- **Rust** toolchain (`rustup`, stable)  
- **Solana CLI** — [install](https://docs.solana.com/cli/install-solana-cli-tools) and a funded wallet for devnet/localnet  
- **Anchor** — [install Anchor](https://www.anchor-lang.com/docs/installation) matching your Solana version  

---

## Repository layout

```
healthcare-solana/
├── program/                 # Anchor workspace
│   ├── Anchor.toml
│   ├── programs/healthcare/ # Rust program source
│   └── tests/               # TypeScript integration tests
├── frontend/                # Next.js app
│   ├── src/app/             # Routes & dashboard pages
│   ├── src/idl/             # healthcare.json (IDL for Anchor TS)
│   └── src/lib/             # Anchor provider, PDAs, explorer helpers
├── package.json             # Convenience scripts (build/test/dev)
└── README.md
```

---

## Setup

### 1. Clone and install the frontend

```bash
cd frontend
npm install
```

### 2. Configure environment variables

Create `frontend/.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_HOSPITAL_AUTHORITY` | **Yes** for most flows | Public key of the wallet that registered the hospital (used for PDA seeds and role checks) |
| `NEXT_PUBLIC_PROGRAM_ID` | No | Deployed program ID; defaults to the ID in the repo IDL if unset |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No | `devnet` \| `testnet` \| `mainnet-beta` (default: `devnet`) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Custom RPC; otherwise cluster default from `NEXT_PUBLIC_SOLANA_NETWORK` |

Example:

```env
NEXT_PUBLIC_HOSPITAL_AUTHORITY=YourHospitalAuthorityPubkeyHere
NEXT_PUBLIC_SOLANA_NETWORK=devnet
# NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

Restart the dev server after changing env vars.

### 3. Build and deploy the program (optional for UI-only exploration)

From the `program` directory (with Solana config and Anchor installed):

```bash
cd program
anchor build
# Deploy to your cluster, then align frontend IDL + PROGRAM_ID with the deployment
```

The declared program ID in this repo is:

`6FyZincSKRMEJkiFxB3bHkP1rJJnEMoGf3FUCqs8tKgK`

Use `anchor keys list` / `solana-keygen` and update `declare_id!`, `Anchor.toml`, and the frontend IDL + env if you deploy a different keypair.

### 4. Run the development server

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect a wallet, and use the sidebar to navigate.

### Root-level scripts

From the repository root:

```bash
npm run build:program   # anchor build in ./program
npm run test:program    # anchor test in ./program
npm run dev:frontend    # next dev in ./frontend
npm run anchor -- <args>  # proxy to anchor in ./program
```

---

## Production build (frontend)

```bash
cd frontend
npm run build
npm start
```

---

## IDL and program parity

The TypeScript client loads `frontend/src/idl/healthcare.json`. If you:

- Add or rename instructions or accounts in Rust, or  
- Change account field order or discriminators,

regenerate the IDL (`anchor idl build` / `anchor build` artifacts) and replace the JSON, then adjust any hand-maintained types in `frontend/src/types/healthcare-program.ts` as needed. Mismatches cause decode errors or failed transactions at runtime.

---

## Testing the program

```bash
cd program
anchor test
```

Requires a working Anchor + Solana toolchain and compatible cluster configuration.

---

## Disclaimer

This project is intended for **learning and demonstration**. It is not a certified medical device, HIPAA-compliant product, or legal billing system. Do not use it for real patient care or regulated workflows without a full security, privacy, and compliance review.

---

## License

This repository is provided as-is for educational purposes. Add a `LICENSE` file if you redistribute or fork the project.
