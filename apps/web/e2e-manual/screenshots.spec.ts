import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const OUT = path.resolve(__dirname, "../../../docs/manual/images");
const shot = (name: string) => path.join(OUT, `${name}.png`);

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.addInitScript((t) => window.localStorage.setItem("robosim-theme", t), theme);
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

test("home page", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/");
  await settle(page);
  await page.screenshot({ path: shot("home-page") });
});

test("theme switcher in dark and light", async ({ page }) => {
  const clip = { x: 0, y: 0, width: 1366, height: 560 };
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  await page.screenshot({ path: shot("theme-dark"), clip });

  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await page.mouse.move(0, 0);
  await settle(page);
  await page.screenshot({ path: shot("theme-light"), clip });
});

test("engineering number fields", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  const field = page.locator("#controls").getByRole("spinbutton", { name: "Resistance" });
  await field.fill("4.7k");
  await field.press("Enter");
  await page.mouse.move(0, 0);
  const row = page.locator("#controls").getByText("Engineering numbers").locator("..");
  await row.screenshot({ path: shot("number-field") });
});

test("workspace: panels, toolbar and inspector", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  const workspace = page.locator("#workspace");
  await workspace.scrollIntoViewIfNeeded();
  // Show a toolbar tooltip in the picture.
  await workspace.getByRole("radio", { name: "Wire" }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await settle(page);
  await workspace.screenshot({ path: shot("workspace") });
});
