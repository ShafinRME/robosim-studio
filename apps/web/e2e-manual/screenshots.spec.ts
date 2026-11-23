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

test.describe("studio workspace", () => {
  test.beforeEach(async ({ page }) => {
    await setTheme(page, "dark");
    await page.goto("/studio");
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
    await settle(page);
  });

  test("overview with status bar", async ({ page }) => {
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByTestId("studio-canvas").hover({ position: { x: 240, y: 120 } });
    await settle(page);
    await page.screenshot({ path: shot("studio-overview") });
    await page.screenshot({
      path: shot("studio-status-bar"),
      clip: { x: 0, y: 768 - 24, width: 1366, height: 24 },
    });
  });

  test("floating group", async ({ page }) => {
    const inspector = page
      .locator(".dv-groupview")
      .filter({ has: page.locator(".dv-tab", { hasText: "Inspector" }) });
    await inspector.getByRole("button", { name: "Float this group" }).click();
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: shot("studio-floating") });
  });

  test("view menu", async ({ page }) => {
    await page.getByRole("menuitem", { name: "View" }).click();
    await expect(page.getByRole("menuitem", { name: "Reset layout" })).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: shot("studio-view-menu"),
      clip: { x: 0, y: 0, width: 640, height: 260 },
    });
  });

  test("command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search commands" }).fill("lay");
    await settle(page);
    await page.screenshot({
      path: shot("command-palette"),
      clip: { x: 300, y: 60, width: 766, height: 460 },
    });
  });

  test("project name and undo", async ({ page }) => {
    const name = page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
    await name.fill("Line follower");
    await name.press("Enter");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /Undo Rename project/ })).toBeVisible();
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: shot("studio-undo") });
  });

  test("file menu", async ({ page }) => {
    await page.getByRole("menuitem", { name: "File" }).click();
    await expect(page.getByRole("menuitem", { name: "Copy share link" })).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: shot("studio-file-menu"),
      clip: { x: 0, y: 0, width: 640, height: 300 },
    });
  });

  test("recent projects window", async ({ page }) => {
    const name = page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
    await name.fill("Line follower");
    await name.press("Enter");
    await page.getByRole("button", { name: "New project" }).click();
    await name.fill("Robot arm");
    await name.press("Enter");
    await page.keyboard.press("Alt+O");
    const dialog = page.getByRole("dialog", { name: "Recent projects" });
    await expect(dialog.getByRole("listitem")).toHaveCount(2);
    await settle(page);
    await dialog.screenshot({ path: shot("recent-projects") });
  });

  test("keyboard shortcuts window", async ({ page }) => {
    await page.getByTestId("studio-canvas").click();
    await page.keyboard.press("Control+Slash");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await settle(page);
    await dialog.screenshot({ path: shot("keyboard-shortcuts") });
  });
});
