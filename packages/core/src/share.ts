/**
 * Share links (ADR 005): a small project packed into the link itself.
 *
 * `/studio#share=<token>`: the token is the project JSON, deflated and base64url-encoded. It lives in
 * the URL fragment (after `#`), which browsers never send to a server, so no server ever sees the
 * project. Links are capped in length; opening one decodes with an output-size limit (no
 * decompression bombs) and validates the project like any file.
 */
import { Inflate, deflateSync, strFromU8, strToU8 } from "fflate";
import { parseProject, type Project, type ProjectLoadResult } from "./project";

export const SHARE_HASH_KEY = "share";
/** Longest token we create or accept (links stay usable in chats and e-mail). */
export const MAX_SHARE_TOKEN_CHARS = 8_000;
/** A shared project may unpack to at most this much JSON. */
export const MAX_SHARE_PROJECT_CHARS = 1_000_000;

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DECODE = new Map([...BASE64URL].map((char, index) => [char, index]));

/** Base64url without padding (RFC 4648 §5), framework-free. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += BASE64URL[a >> 2];
    out += BASE64URL[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += BASE64URL[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += BASE64URL[c & 63];
  }
  return out;
}

/** Decodes base64url (no padding). Returns null for any character outside the alphabet. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of text) {
    const digit = DECODE.get(char);
    if (digit === undefined) return null;
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

export type ShareTokenResult =
  { ok: true; token: string } | { ok: false; reason: "too-large"; length: number };

/** Packs a project into a share token, or says it is too large for a link. */
export function createShareToken(project: Project): ShareTokenResult {
  const token = toBase64Url(deflateSync(strToU8(JSON.stringify(project)), { level: 9 }));
  return token.length <= MAX_SHARE_TOKEN_CHARS
    ? { ok: true, token }
    : { ok: false, reason: "too-large", length: token.length };
}

/** The full share link for a token, e.g. `https://…/studio#share=…`. */
export function shareUrl(studioUrl: string, token: string): string {
  return `${studioUrl.split("#")[0]}#${SHARE_HASH_KEY}=${token}`;
}

/** The share token in a URL fragment (`#share=…`), or null when there is none. */
export function shareTokenFromHash(hash: string): string | null {
  const prefix = `#${SHARE_HASH_KEY}=`;
  return hash.startsWith(prefix) ? hash.slice(prefix.length) : null;
}

const fail = (issue: string, reason: "corrupt" | "too-large" = "corrupt"): ProjectLoadResult => ({
  ok: false,
  reason,
  issues: [issue],
});

/** Unpacks and validates a shared project. */
export function readShareToken(token: string): ProjectLoadResult {
  if (token.length > MAX_SHARE_TOKEN_CHARS) return fail("the link is too long", "too-large");
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length === 0) return fail("the link is damaged");

  const chunks: Uint8Array[] = [];
  let size = 0;
  let tooLarge = false;
  const inflate = new Inflate((chunk) => {
    if (tooLarge) return;
    size += chunk.length;
    if (size > MAX_SHARE_PROJECT_CHARS) tooLarge = true;
    else chunks.push(chunk);
  });
  try {
    // Small slices, so the size limit stops the work early.
    for (let offset = 0; offset < bytes.length && !tooLarge; offset += 1024) {
      inflate.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    }
  } catch {
    return fail("the link is damaged");
  }
  if (tooLarge) return fail("the shared project is too large", "too-large");

  const json = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    json.set(chunk, offset);
    offset += chunk.length;
  }
  let text: string;
  try {
    text = strFromU8(json);
  } catch {
    return fail("the link is damaged");
  }
  return parseProject(text);
}
