import { expect, test, type Page } from "@playwright/test";

const nameField = (page: Page) =>
  page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
const tabs = (page: Page) => page.getByRole("tablist", { name: "Open projects" }).getByRole("tab");

async function rename(page: Page, name: string) {
  await nameField(page).fill(name);
  await nameField(page).press("Enter");
}

test.describe("projects are saved in the browser", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(nameField(page)).toHaveValue("Untitled");
  });

  test("open projects and the active tab survive a reload", async ({ page }) => {
    await rename(page, "Rover");
    await page.getByRole("button", { name: "New project" }).click();
    await rename(page, "Arm");
    await tabs(page).filter({ hasText: "Rover" }).click();

    await page.reload();
    await expect(tabs(page)).toHaveText(["Rover", "Arm"]);
    await expect(tabs(page).filter({ hasText: "Rover" })).toHaveAttribute("aria-selected", "true");
    await expect(nameField(page)).toHaveValue("Rover");
  });

  test("an edit is saved even when the page is reloaded at once", async ({ page }) => {
    await rename(page, "Quick save");
    await page.reload(); // well inside the 1 s autosave delay
    await expect(nameField(page)).toHaveValue("Quick save");
  });

  test("a closed project is not reopened", async ({ page }) => {
    await page.getByRole("button", { name: "New project" }).click();
    await rename(page, "Temporary");
    await page.getByTitle("Close Temporary", { exact: true }).click();
    await expect(tabs(page)).toHaveCount(1);

    await page.reload();
    await expect(tabs(page)).toHaveText(["Untitled"]);
  });

  test("undo history starts fresh after a reload", async ({ page }) => {
    await rename(page, "Saved name");
    await page.reload();
    await expect(nameField(page)).toHaveValue("Saved name");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /^Undo/ })).toBeDisabled();
  });
});
