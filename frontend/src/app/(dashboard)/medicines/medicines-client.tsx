"use client";

import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Plus, Search } from "lucide-react";
import * as React from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHealthcareProgram, useHospitalAuthorityPubkey } from "@/hooks/use-healthcare-program";
import { getAccountInfoWithRetry } from "@/lib/rpc-retry";
import { toastSolanaError, toastSolanaSuccess } from "@/lib/solana-toast";
import { hospitalAuthorityPda, managerWalletPda, medicinePda } from "@/lib/pda";
import {
  asHealthcareProgram,
  type MedicineAccountData,
} from "@/types/healthcare-program";

type MedicineRow = MedicineAccountData & { pubkey: PublicKey };

const LAMPORTS_PER_SOL = BigInt("1000000000");

function lamportsToSolDisplay(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL;
  const frac = lamports % LAMPORTS_PER_SOL;
  if (frac === BigInt(0)) {
    return `${whole}`;
  }
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function toLamportsBigInt(raw: MedicineAccountData["unitPriceLamports"]): bigint {
  if (typeof raw === "bigint") {
    return raw;
  }
  if (typeof raw === "number") {
    return BigInt(Math.trunc(raw));
  }
  if (raw && typeof raw === "object" && "toString" in raw) {
    try {
      return BigInt(String((raw as { toString(): string }).toString()));
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

function normalizeMedicine(
  publicKey: PublicKey,
  raw: MedicineAccountData & {
    medicine_id?: { toNumber(): number };
    stock_quantity?: number;
    unit_price_lamports?: MedicineAccountData["unitPriceLamports"];
    requires_prescription?: boolean;
  }
): MedicineRow {
  return {
    pubkey: publicKey,
    hospital: raw.hospital,
    medicineId: raw.medicineId ?? raw.medicine_id ?? { toNumber: () => 0 },
    name: raw.name,
    sku: raw.sku,
    stockQuantity: raw.stockQuantity ?? raw.stock_quantity ?? 0,
    unitPriceLamports: raw.unitPriceLamports ?? raw.unit_price_lamports ?? 0,
    requiresPrescription: raw.requiresPrescription ?? raw.requires_prescription ?? false,
    bump: raw.bump,
  };
}

export function MedicinesClient() {
  const { program, hospitalAuthority, canTransact } = useHealthcareProgram();
  const hospitalAuthorityFromEnv = useHospitalAuthorityPubkey();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [rows, setRows] = React.useState<MedicineRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [initialStock, setInitialStock] = React.useState("");
  const [unitPriceLamports, setUnitPriceLamports] = React.useState("");
  const [requiresPrescription, setRequiresPrescription] = React.useState(false);

  const loadMedicines = React.useCallback(async () => {
    const hp = asHealthcareProgram(program);
    if (!hp || !hospitalAuthority) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
      const fetched = await hp.account.medicine.all([
        {
          memcmp: {
            offset: 8,
            bytes: hospitalPda.toBase58(),
          },
        },
      ]);

      const mapped: MedicineRow[] = fetched.map(({ publicKey, account }) =>
        normalizeMedicine(publicKey, account as MedicineAccountData)
      );
      mapped.sort((x, y) => y.medicineId.toNumber() - x.medicineId.toNumber());
      setRows(mapped);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load medicines");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [program, hospitalAuthority]);

  React.useEffect(() => {
    void loadMedicines();
  }, [loadMedicines]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) {
        return true;
      }
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        String(r.medicineId.toNumber()).includes(q)
      );
    });
  }, [rows, search]);

  const resetForm = () => {
    setName("");
    setSku("");
    setInitialStock("");
    setUnitPriceLamports("");
    setRequiresPrescription(false);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!program || !hospitalAuthority || !publicKey) {
      setFormError("Connect a wallet and configure hospital authority.");
      return;
    }

    if (!name.trim() || !sku.trim()) {
      setFormError("Name and SKU are required.");
      return;
    }

    const stockNum = Number.parseInt(initialStock.trim(), 10);
    if (!Number.isFinite(stockNum) || stockNum < 0 || stockNum > 0xffffffff) {
      setFormError("Initial stock must be a valid non-negative u32.");
      return;
    }

    let priceBn: BN;
    try {
      const raw = unitPriceLamports.trim().replace(/_/g, "");
      if (!raw) {
        throw new Error("empty");
      }
      priceBn = new BN(raw, 10);
      if (priceBn.isNeg()) {
        throw new Error("negative");
      }
    } catch {
      setFormError("Unit price (lamports) must be a non-negative integer.");
      return;
    }

    const [hospitalPda] = hospitalAuthorityPda(hospitalAuthority);
    const hp = asHealthcareProgram(program);
    if (!hp) {
      setFormError("Program not ready.");
      return;
    }

    let nextMedicineId: number;
    try {
      const hospitalAccount = await hp.account.hospital.fetch(hospitalPda);
      nextMedicineId = hospitalAccount.nextMedicineId.toNumber();
    } catch {
      setFormError("Could not load hospital account. Check authority and RPC.");
      return;
    }

    const [medicineAccount] = medicinePda(hospitalPda, nextMedicineId);
    const collision = await getAccountInfoWithRetry(connection, medicineAccount);
    if (collision) {
      setFormError(
        "Medicine PDA already exists; refresh the page after the chain catches up."
      );
      return;
    }

    const isAuthority = publicKey.equals(hospitalAuthority);
    const [managerAccount] = managerWalletPda(hospitalPda, publicKey);
    const managerInfo = await getAccountInfoWithRetry(connection, managerAccount);
    const isManager =
      managerInfo !== null &&
      managerInfo.data.length > 0 &&
      !isAuthority;

    if (!isAuthority && !isManager) {
      setFormError(
        "Your wallet must be the hospital authority or a registered manager."
      );
      return;
    }

    setSubmitting(true);
    try {
      const base = {
        hospital: hospitalPda,
        admin: publicKey,
        medicine: medicineAccount,
        systemProgram: SystemProgram.programId,
      };

      const tx = isAuthority
        ? await hp.methods
            .addMedicine(
              name.trim(),
              sku.trim(),
              stockNum,
              priceBn,
              requiresPrescription
            )
            .accounts(base)
            .rpc()
        : await hp.methods
            .addMedicine(
              name.trim(),
              sku.trim(),
              stockNum,
              priceBn,
              requiresPrescription
            )
            .accounts({
              ...base,
              manager: managerAccount,
            })
            .rpc();

      await connection.confirmTransaction(tx, "confirmed");
      toastSolanaSuccess("Medicine added to inventory", tx);
      setModalOpen(false);
      resetForm();
      await loadMedicines();
    } catch (err) {
      console.error(err);
      toastSolanaError("Could not add medicine", err);
      setFormError(
        err instanceof Error ? err.message : "Transaction failed. Check console."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {!hospitalAuthorityFromEnv ? (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="alert"
        >
          Set{" "}
          <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
            NEXT_PUBLIC_HOSPITAL_AUTHORITY
          </code>{" "}
          in{" "}
          <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
            .env.local
          </code>{" "}
          to the hospital authority public key, then restart the dev server.
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, SKU, medicine id…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search medicines"
          />
        </div>
        <Button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          disabled={!canTransact}
          className="shrink-0 gap-2"
        >
          <Plus className="size-4" />
          Add medicine
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Price (lamports)
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">≈ SOL</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Rx</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No medicines match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const lam = toLamportsBigInt(r.unitPriceLamports);
                  return (
                    <tr
                      key={r.pubkey.toBase58()}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r.medicineId.toNumber()}
                      </td>
                      <td className="px-4 py-3 font-medium text-card-foreground">
                        {r.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.sku}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.stockQuantity}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {lam.toString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lamportsToSolDisplay(lam)}
                      </td>
                      <td className="px-4 py-3">
                        {r.requiresPrescription ? (
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100">
                            Yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="!top-4 !translate-y-0 fixed left-1/2 -translate-x-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add medicine</DialogTitle>
            <DialogDescription>
              On-chain <code className="text-xs">add_medicine</code>. The next
              medicine id comes from the hospital account; price is in lamports (1 SOL =
              1e9 lamports).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="med-name">Name</Label>
              <Input
                id="med-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="med-sku">SKU</Label>
              <Input
                id="med-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="med-stock">Initial stock</Label>
              <Input
                id="med-stock"
                type="number"
                min={0}
                inputMode="numeric"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="med-price">Unit price (lamports)</Label>
              <Input
                id="med-price"
                placeholder="e.g. 1000000"
                value={unitPriceLamports}
                onChange={(e) => setUnitPriceLamports(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="med-rx"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={requiresPrescription}
                onChange={(e) => setRequiresPrescription(e.target.checked)}
              />
              <Label htmlFor="med-rx" className="font-normal">
                Requires prescription
              </Label>
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !canTransact}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit on-chain"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
