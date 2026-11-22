import { expect, test, type Page } from "@playwright/test";

const dvTab = (page: Page, name: string) => page.locator(".dv-tab", { hasText: name });
const projectTabs = (page: Page) =>
  page.getByRole("tablist", { name: "Open projects" }).getByRole("tab");
const status = (page: Page) =>
  page.getByRole("contentinfo", { name: "Status bar" }).getByRole("status");
const shortcutsDialog = (page: Page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

test.describe("keyboard shortcuts", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(dvTab(page, "Canvas")).toBeVisible();
    // Start from the page, not the address bar.
    await page.getByTestId("studio-canvas").click();
  });

  test("Alt+1…4 show and hide panels", async ({ page }) => {
    await page.keyboard.press("Alt+4");
    await expect(dvTab(page, "Console")).toHaveCount(0);
    await page.keyboard.press("Alt+4");
    await expect(dvTab(page, "Console")).toBeVisible();
    await page.keyboard.press("Alt+1");
    await expect(dvTab(page, "Explorer")).toHaveCount(0);
  });

  test("Alt+N, Alt+] / Alt+[ and Alt+W work with project tabs", async ({ page }) => {
    await page.keyboard.press("Alt+N");
    await page.keyboard.press("Alt+N");
    await expect(projectTabs(page)).toHaveCount(3);
    await expect(projectTabs(page).nth(2)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Alt+BracketRight");
    await expect(projectTabs(page).first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Alt+BracketLeft");
    await expect(projectTabs(page).nth(2)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Alt+W");
    await expect(projectTabs(page)).toHaveCount(2);
  });

  test("Alt+Shift+R resets the layout and Alt+Shift+L toggles Low-end mode", async ({ page }) => {
    await page.keyboard.press("Alt+Shift+R");
    await expect(status(page)).toHaveText("Layout reset to the default.");
    await page.keyboard.press("Alt+Shift+L");
    await expect(status(page)).toHaveText("Low-end mode on: animations off.");
  });

  test("Ctrl+/ and ? open the shortcuts window, which lists the keys", async ({ page }) => {
    await page.keyboard.press("Control+Slash");
    await expect(shortcutsDialog(page)).toBeVisible();
    await expect(shortcutsDialog(page)).toContainText("Show or hide Console");
    await expect(shortcutsDialog(page).getByText("Reset layout").locator("..")).toContainText(
      "AltShiftR",
    );
    await page.keyboard.press("Escape");
    await expect(shortcutsDialog(page)).toBeHidden();

    await page.keyboard.press("Shift+Slash");
    await expect(shortcutsDialog(page)).toBeVisible();
  });

  test("while typing, only Ctrl shortcuts work", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const search = page.getByRole("combobox", { name: "Search commands" });
    await expect(search).toBeFocused();

    await page.keyboard.type("?");
    await expect(search).toHaveValue("?");
    await expect(shortcutsDialog(page)).toBeHidden();

    await page.keyboard.press("Alt+4");
    await expect(dvTab(page, "Console")).toBeVisible();

    // Ctrl+K closes the palette again even from inside the search box.
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
  });

  test("menus and the palette show the keys", async ({ page }) => {
    await page.getByRole("menuitem", { name: "View" }).click();
    await expect(page.getByRole("menuitemcheckbox", { name: /Console/ })).toContainText("Alt+4");
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search commands" }).fill("new project");
    await expect(page.getByRole("option").first()).toContainText("AltN");
  });
});
