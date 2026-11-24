import { expect, test, type Page } from "@playwright/test";

const statusBar = (page: Page) => page.getByRole("contentinfo", { name: "Status bar" });
const lowEndButton = (page: Page) => statusBar(page).getByRole("button", { name: /Low-end/ });

test.describe("system information and automatic Low-end mode", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("Help → System information shows this computer and the Low-end choice", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("menuitem", { name: "Help" }).click();
    await page.getByRole("menuitem", { name: "System information" }).click();
    const dialog = page.getByRole("dialog", { name: "System information" });
    const facts = dialog.getByRole("definition");
    await expect(dialog.getByRole("term")).toHaveText([
      "Memory",
      "Processor cores",
      "3D graphics (WebGL2)",
      "Graphics",
      "Drawn by",
      "Low-end mode recommended",
    ]);
    await expect(facts.nth(2)).toHaveText(/Available|Not available/);
    await expect(dialog).toContainText("Low-end mode is off (your choice).");

    await dialog.getByRole("button", { name: "Turn on" }).click();
    await expect(dialog).toContainText("Low-end mode is on (your choice).");
    await page.keyboard.press("Escape");
    await expect(lowEndButton(page)).toHaveText("Low-end on");
  });

  test.describe("on a computer without a graphics card", () => {
    // No stored choice: the studio decides by itself. Test browsers draw graphics in software.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Low-end mode switches itself on and says why", async ({ page }) => {
      await page.goto("/studio");
      await expect(lowEndButton(page)).toHaveText("Low-end on· auto");
      await expect(page.locator("html")).toHaveAttribute("data-low-end", "");
      await expect(page.getByRole("log", { name: "Studio messages" })).toContainText(
        "Low-end mode is on for this computer (graphics drawn without a graphics card)",
      );
      await expect(lowEndButton(page)).toHaveAttribute("title", /graphics drawn without/);

      // Switching it off is remembered as the user's own choice.
      await lowEndButton(page).click();
      await expect(lowEndButton(page)).toHaveText("Low-end off");
      await page.reload();
      await expect(lowEndButton(page)).toHaveText("Low-end off");
    });
  });
});
