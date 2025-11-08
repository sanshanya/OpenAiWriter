import crypto from "node:crypto";

import type { XXHashAPI } from "xxhash-wasm";
import xxhash from "xxhash-wasm";

let xxhashPromise: Promise<XXHashAPI> | null = null;

const getHasher = () => {
  if (!xxhashPromise) {
    xxhashPromise = xxhash();
  }
  return xxhashPromise;
};

export const computeContextHash = async (input: string): Promise<string> => {
  const normalized = input ?? "";
  try {
    const hasher = await getHasher();
    return hasher.h64ToString(normalized);
  } catch {
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
};
