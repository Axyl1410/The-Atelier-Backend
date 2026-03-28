import { getRuntimeKey } from "hono/adapter";

export async function utils() {
  if (getRuntimeKey() === "workerd") {
    const { env } = await import("cloudflare:workers").then((m) => m);
    return env;
  }
  return process.env as unknown as Cloudflare.Env;
}

export const env = await utils();
