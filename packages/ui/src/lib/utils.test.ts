import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("lets later Tailwind classes win over conflicting earlier ones", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("ignores falsy values and supports conditional objects", () => {
    const disabled = false;
    expect(cn("btn", disabled && "opacity-50", { "font-bold": true, hidden: false })).toBe(
      "btn font-bold",
    );
  });
});
