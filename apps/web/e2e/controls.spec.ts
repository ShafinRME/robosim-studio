import { expect, test } from "@playwright/test";

test.describe("UI kit controls", () => {
  test("engineering number field accepts SI prefixes and rejects nonsense", async ({ page }) => {
    await page.goto("/ui-kit");
    const resistance = page.getByRole("spinbutton", { name: "Resistance" });
    const current = page.locator("output");

    await resistance.fill("10k");
    await resistance.press("Enter");
    await expect(resistance).toHaveValue("10 k");
    await expect(current).toHaveText("I = 500 µA");

    await resistance.fill("abc");
    await resistance.press("Enter");
    await expect(resistance).toHaveAttribute("aria-invalid", "true");
    await expect(current).toHaveText("I = 500 µA");

    await resistance.press("Escape");
    await expect(resistance).toHaveValue("10 k");
  });

  test("arrow keys step the value, Shift steps ×10", async ({ page }) => {
    await page.goto("/ui-kit");
    const supply = page.getByRole("spinbutton", { name: "Supply" });
    await supply.focus();
    await supply.press("ArrowUp");
    await expect(supply).toHaveValue("5.1");
    await supply.press("Shift+ArrowDown");
    await expect(supply).toHaveValue("4.1");
  });

  test("switch and run button toggle state", async ({ page }) => {
    await page.goto("/ui-kit");
    const snap = page.getByRole("switch").first();
    await expect(snap).toHaveAttribute("aria-checked", "true");
    await snap.click();
    await expect(snap).toHaveAttribute("aria-checked", "false");

    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.getByText("Running", { exact: true })).toBeVisible();
  });
});
