// Chiffrement du QG : tout ce qui est publié (site, branche « state », messages ntfy)
// est chiffré en AES-256-GCM avec une clé dérivée du code secret QG_KEY.
// Le même format est relu dans le navigateur (site/boot.js).
import { gzipSync, gunzipSync } from "node:zlib";

const te = new TextEncoder();
const MAGIC = [0x51, 0x47, 0x31]; // "QG1"
const subtle = globalThis.crypto.subtle;

export const b64u = {
  enc: (buf) => Buffer.from(buf).toString("base64url"),
  dec: (s) => new Uint8Array(Buffer.from(String(s).trim(), "base64url")),
};

export function newKey() {
  return b64u.enc(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

export async function deriveKeys(qgKey) {
  const raw = b64u.dec(qgKey || "");
  if (raw.length !== 32) throw new Error("QG_KEY invalide : il faut le code de 43 caractères donné à l'installation.");
  const ikm = await subtle.importKey("raw", raw, "HKDF", false, ["deriveKey", "deriveBits"]);
  const p = (info) => ({ name: "HKDF", hash: "SHA-256", salt: te.encode("qg-v1"), info: te.encode(info) });
  const data = await subtle.deriveKey(p("data"), ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const topicBits = await subtle.deriveBits(p("topic"), ikm, 128);
  return { data, topic: "qg" + Buffer.from(topicBits).toString("hex") };
}

export async function seal(key, bytes) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  const out = new Uint8Array(3 + 12 + ct.length);
  out.set(MAGIC, 0); out.set(iv, 3); out.set(ct, 15);
  return out;
}

export async function unseal(key, bytes) {
  const b = new Uint8Array(bytes);
  if (b[0] !== MAGIC[0] || b[1] !== MAGIC[1] || b[2] !== MAGIC[2]) throw new Error("Fichier QG illisible");
  return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: b.slice(3, 15) }, key, b.slice(15)));
}

export const sealJSON = (key, obj) => seal(key, gzipSync(Buffer.from(JSON.stringify(obj))));
export const unsealJSON = async (key, bytes) => JSON.parse(gunzipSync(await unseal(key, bytes)).toString("utf8"));
export const sealText = async (key, obj) => b64u.enc(await sealJSON(key, obj));
export const unsealText = async (key, s) => unsealJSON(key, b64u.dec(s));

export async function shortHash(s, n = 16) {
  const h = await subtle.digest("SHA-256", te.encode(s));
  return Buffer.from(h).toString("hex").slice(0, n);
}
