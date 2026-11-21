import { expect, test } from "@playwright/test";

test.describe("UI kit workspace (panel · toolbar · inspector)", () => {
  test("inspector values update live and warn when the resistor overheats", async ({ page }) => {
    await page.goto("/ui-kit");
    const inspector = page.getByRole("region", { name: "Inspector" });
    const resistance = inspector.getByRole("spinbutton", { name: "Resistance" });

    await expect(inspector.getByText("13.6 mA")).toBeVisible();
    await resistance.fill("10");
    await resistance.press("Enter");
    await expect(inspector.getByText(/too hot!/)).toBeVisible();
    await expect(page.getByText("1 warning")).toBeVisible();

    await resistance.fill("1k");
    await resistance.press("Enter");
    await expect(inspector.getByText("3 mA")).toBeVisible();
    await expect(inspector.getByText(/too hot!/)).toHaveCount(0);
  });

  test("toolbar is one tab stop with arrow-key navigation", async ({ page }) => {
    await page.goto("/ui-kit");
    const toolbar = page.getByRole("toolbar", { name: "Canvas tools" });
    const select = toolbar.getByRole("radio", { name: "Select" });
    await select.focus();
    await page.keyboard.press("ArrowRight");
    await expect(toolbar.getByRole("radio", { name: "Wire" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("tool: wire")).toBeVisible();
  });

  test("pausing stops the live simulation", async ({ page }) => {
    await page.goto("/ui-kit");
    const toolbar = page.getByRole("toolbar", { name: "Canvas tools" });
    await toolbar.getByRole("button", { name: "Pause" }).click();
    await expect(toolbar.getByText("Paused")).toBeVisible();
    await expect(page.getByRole("region", { name: "Inspector" }).getByText("0 A")).toBeVisible();
  });

  test("inspector sections collapse", async ({ page }) => {
    await page.goto("/ui-kit");
    const inspector = page.getByRole("region", { name: "Inspector" });
    const transform = inspector.getByRole("button", { name: "Transform" });
    await expect(transform).toHaveAttribute("aria-expanded", "true");
    await transform.click();
    await expect(transform).toHaveAttribute("aria-expanded", "false");
    await expect(inspector.getByRole("spinbutton", { name: "Position X" })).toBeHidden();
  });
});
