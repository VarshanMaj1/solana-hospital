"use client";

import type { Connection, PublicKey } from "@solana/web3.js";

function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const msg = err.message.toLowerCase();
  return msg.includes("429") || msg.includes("rate limit");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads account info with a few retries when RPC returns 429.
 */
export async function getAccountInfoWithRetry(
  connection: Connection,
  account: PublicKey
) {
  const delays = [200, 500, 900];
  for (let i = 0; i <= delays.length; i += 1) {
    try {
      return await connection.getAccountInfo(account);
    } catch (err) {
      if (!isRateLimitError(err) || i === delays.length) {
        throw err;
      }
      await sleep(delays[i]);
    }
  }
  return null;
}
