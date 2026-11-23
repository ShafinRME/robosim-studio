import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { createProject, type Part, type Project } from "./project";
import {
  MAX_SHARE_TOKEN_CHARS,
  createShareToken,
  fromBase64Url,
  readShareToken,
  shareTokenFromHash,
  shareUrl,
  toBase64Url,
} from "./share";

const NOW = new Date("2026-11-23T10:00:00.000Z");
const part = (i: number): Part => ({
  id: `p${i}`,
  type: "resistor",
  name: `R${i}`,
  x: i * 7.25,
  y: 0 - i * 3, // never -0 (JSON turns -0 into 0)
  rotation: (i * 90) % 360,
  props: { resistance: 100 + i, note: `part ${i}`, on: i % 2 === 0 },
});
const project = (parts = 3): Project => ({
  ...createProject({ name: "Shared bot", lab: "circuit", id: "s1", now: NOW }),
  parts: Array.from({ length: parts }, (_, i) => part(i)),
});

function tokenOf(p: Project): string {
  const result = createShareToken(p);
  if (!result.ok) throw new Error("too large");
  return result.token;
}

describe("base64url", () => {
  it.each([[[]], [[0]], [[255, 254]], [[1, 2, 3]], [[0, 0, 0, 0, 251, 255, 191]]])(
    "round-trips %j",
    (bytes) => {
      const encoded = toBase64Url(new Uint8Array(bytes));
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect([...fromBase64Url(encoded)!]).toEqual(bytes);
    },
  );

  it("matches standard base64url", () => {
    expect(toBase64Url(strToU8("hello?>"))).toBe("aGVsbG8_Pg");
  });

  it.each(["a+b", "abc=", "a/bc", "é", "a"])("rejects %s", (text) => {
    expect(fromBase64Url(text)).toBeNull();
  });
});

describe("share links", () => {
  it("round-trips a project through a token", () => {
    const p = project();
    expect(readShareToken(tokenOf(p))).toEqual({ ok: true, project: p, fromVersion: 1 });
  });

  it("builds and reads the link fragment", () => {
    const url = shareUrl("https://studio.example/studio#old", "abc");
    expect(url).toBe("https://studio.example/studio#share=abc");
    expect(shareTokenFromHash(url.slice(url.indexOf("#")))).toBe("abc");
    expect(shareTokenFromHash("#other=1")).toBeNull();
    expect(shareTokenFromHash("")).toBeNull();
  });

  it("refuses to make a link for a project that is too large", () => {
    const result = createShareToken(project(400));
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
    if (!result.ok) expect(result.length).toBeGreaterThan(MAX_SHARE_TOKEN_CHARS);
  });

  it.each([
    ["an empty token", ""],
    ["bad characters", "abc$%^"],
    ["random bytes", toBase64Url(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))],
  ])("refuses %s as damaged", (_name, token) => {
    expect(readShareToken(token)).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("refuses an over-long token", () => {
    expect(readShareToken("A".repeat(MAX_SHARE_TOKEN_CHARS + 1))).toMatchObject({
      ok: false,
      reason: "too-large",
    });
  });

  it("stops a decompression bomb hidden in a short link", () => {
    const bomb = toBase64Url(deflateSync(new Uint8Array(5_000_000).fill(32), { level: 9 }));
    expect(bomb.length).toBeLessThan(MAX_SHARE_TOKEN_CHARS);
    expect(readShareToken(bomb)).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("validates the project inside the link", () => {
    const bad = { ...project(), parts: [{ id: "x", onerror: "alert(1)" }] };
    const token = toBase64Url(deflateSync(strToU8(JSON.stringify(bad))));
    expect(readShareToken(token)).toMatchObject({ ok: false, reason: "invalid" });
  });
});
