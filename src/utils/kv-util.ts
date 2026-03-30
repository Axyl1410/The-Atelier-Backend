import { env } from "./cf-util";

interface SaveKvOptions {
  metadata?: KVNamespacePutOptions["metadata"];
  ttlSeconds?: number;
}

function serializeKvValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export async function saveKvKey(
  key: string,
  value: unknown,
  options: SaveKvOptions = {}
) {
  if (!env.KV) {
    throw new Error("KV binding is missing.");
  }

  const putOptions: KVNamespacePutOptions = {};
  if (options.ttlSeconds !== undefined) {
    putOptions.expirationTtl = options.ttlSeconds;
  }
  if (options.metadata !== undefined) {
    putOptions.metadata = options.metadata;
  }

  await env.KV.put(key, serializeKvValue(value), putOptions);
}

export function getKvText(key: string) {
  if (!env.KV) {
    throw new Error("KV binding is missing.");
  }

  return env.KV.get(key);
}

export async function getKvJson<T>(key: string): Promise<T | null> {
  const rawValue = await getKvText(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}
