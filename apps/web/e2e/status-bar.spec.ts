import { expect, test, type Page } from "@playwright/test";

const statusBar = (page: Page) => page.getByRole("contentinfo", { name: "Status bar" });
const lowEndButton = (page: Page) => statusBar(page).getByRole("button", { name: /Low-end/ });

test.describe("studio status bar", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
  });

  test("shows the simulation state, version and Low-end mode", async ({ page }) => {
    await expect(statusBar(page)).toContainText("Idle");
    await expect(statusBar(page)).toContainText("v0.0.0");
    await expect(lowEndButton(page)).toHaveText("Low-end off");
    await expect(lowEndButton(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("shows the pointer position over the canvas", async ({ page }) => {
    const cursor = page.getByTestId("status-cursor");
    await expect(cursor).toHaveText("—");

    const canvas = page.getByTestId("studio-canvas");
    await canvas.hover({ position: { x: 100, y: 50 } });
    await expect(cursor).toHaveText(/X 100\s+Y 50/);

    await page.getByRole("contentinfo", { name: "Status bar" }).hover();
    await expect(cursor).toHaveText("—");
  });

  test("reports layout messages in the status bar and the Console", async ({ page }) => {
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Reset layout" }).click();
    await expect(statusBar(page).getByRole("status")).toHaveText("Layout reset to the default.");
    await expect(page.getByRole("log", { name: "Studio messages" })).toContainText(
      "Layout reset to the default.",
    );

    await page.reload();
    await expect(statusBar(page).getByRole("status")).toHaveText("Saved layout restored.");
  });

  test("warns when a saved layout cannot be used", async ({ page }) => {
    // Leave the studio first: it saves its layout when the page closes.
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("robosim-layout", "{broken"));
    await page.goto("/studio");
    await expect(statusBar(page).getByRole("status")).toHaveText(
      "The saved layout was damaged, so the default layout is shown.",
    );
    await expect(page.getByRole("log", { name: "Studio messages" })).toContainText("warn");
  });

  test("Low-end mode turns animations off and is remembered", async ({ page }) => {
    await lowEndButton(page).click();
    await expect(lowEndButton(page)).toHaveText("Low-end on");
    await expect(lowEndButton(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-low-end", "");
    await expect(statusBar(page).getByRole("status")).toHaveText(
      "Low-end mode on: animations off, lighter updates.",
    );
    const transition = await page
      .locator(".dv-tab")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transition).toBe("0s");

    await page.reload();
    await expect(lowEndButton(page)).toHaveText("Low-end on");

    await lowEndButton(page).click();
    await expect(lowEndButton(page)).toHaveText("Low-end off");
    await expect(page.locator("html")).not.toHaveAttribute("data-low-end");
  });

  test("project tabs post messages", async ({ page }) => {
    await page.getByRole("button", { name: "New project" }).click();
    await expect(statusBar(page).getByRole("status")).toHaveText("New project “Untitled 2”.");
  });
});
