import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const PASSWORD_SALT_LENGTH = 16;

const SCRYPT_KEY_LENGTH = 64;
// Better Auth 1.5.6 が使っていた scrypt パラメータに合わせる
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 16,
  p: 1,
  maxmem: 128 * 16_384 * 16 * 2,
} as const;

export async function hashPassword(password: string) {
  // better-auth/utils#16 と同じく `${salt}:${hex(key)}` 形式で保存する
  const salt = toHex(
    crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_LENGTH))
  );
  const derivedKey = await deriveScryptKey(password, salt);

  return `${salt}:${toHex(derivedKey)}`;
}

export async function verifyPassword(input: {
  hash: string;
  password: string;
}) {
  const [salt, hash] = input.hash.split(":");

  if (!(salt && hash)) {
    return false;
  }

  const derivedKey = await deriveScryptKey(input.password, salt);

  return timingSafeEqual(Buffer.from(derivedKey), Buffer.from(hash, "hex"));
}

function deriveScryptKey(password: string, salt: string) {
  return new Promise<Uint8Array>((resolve, reject) => {
    scryptCallback(
      password.normalize("NFKC"),
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(new Uint8Array(derivedKey));
      }
    );
  });
}

function toHex(value: Uint8Array) {
  return Buffer.from(value).toString("hex");
}
