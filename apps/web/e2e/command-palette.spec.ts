import { expect, test, type Page } from "@playwright/test";

const palette = (page: Page) => page.getByRole("dialog", { name: "Command palette" });
const search = (page: Page) => page.getByRole("combobox", { name: "Search commands" });
const options = (page: Page) => palette(page).getByRole("option");
const status = (page: Page) =>
  page.getByRole("contentinfo", { name: "Status bar" }).getByRole("status");

test.describe("command palette", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
  });

  test("Ctrl+K opens it with the search focused, Esc closes it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
  });

  test("the top bar button opens it", async ({ page }) => {
    await page.getByRole("button", { name: /Search commands/ }).click();
    await expect(palette(page)).toBeVisible();
  });

  test("type and press Enter to run a command", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await search(page).fill("reset lay");
    await expect(options(page).first()).toContainText("Reset layout");
    await page.keyboard.press("Enter");

    await expect(palette(page)).toBeHidden();
    await expect(status(page)).toHaveText("Layout reset to the default.");
  });

  test("arrow keys choose and a click runs", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await search(page).fill("theme");
    await expect(options(page)).toHaveCount(3);
    await page.keyboard.press("ArrowDown");
    await expect(options(page).nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(options(page).nth(2)).toHaveAttribute("aria-selected", "true");

    await options(page).filter({ hasText: "Light theme" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
  });

  test("shows a message when nothing matches", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await search(page).fill("zzzz");
    await expect(options(page)).toHaveCount(0);
    await expect(palette(page)).toContainText("No matching commands");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeVisible();
  });

  test("disabled commands are shown but do not run", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await search(page).fill("next project tab");
    const next = options(page).first();
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeVisible();
  });

  test("recently used commands come first", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await search(page).fill("low-end");
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText("Low-end mode on: animations off.");

    await page.keyboard.press("Control+k");
    await expect(options(page).first()).toContainText("Toggle Low-end mode");
  });

  test("menus and the palette run the same commands", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await search(page).fill("hide console");
    await page.keyboard.press("Enter");
    await expect(page.locator(".dv-tab", { hasText: "Console" })).toHaveCount(0);

    await page.getByRole("menuitem", { name: "View" }).click();
    await expect(page.getByRole("menuitemcheckbox", { name: "Console" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
