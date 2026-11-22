import { expect, test, type Page } from "@playwright/test";

const nameField = (page: Page) =>
  page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
const projectTab = (page: Page, name: string) =>
  page.getByRole("tablist", { name: "Open projects" }).getByRole("tab", { name });
const status = (page: Page) =>
  page.getByRole("contentinfo", { name: "Status bar" }).getByRole("status");

async function rename(page: Page, name: string) {
  await nameField(page).fill(name);
  await nameField(page).press("Enter");
}

test.describe("project edits and undo / redo", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(nameField(page)).toHaveValue("Untitled");
  });

  test("the Inspector shows the project and renames it (and its tab)", async ({ page }) => {
    const inspector = page
      .locator(".dv-groupview")
      .filter({ has: page.getByRole("textbox", { name: "Name" }) });
    await expect(inspector).toContainText("Lab");
    await expect(inspector).toContainText("Parts");
    await rename(page, "Line follower");
    await expect(projectTab(page, "Line follower")).toBeVisible();
  });

  test("Ctrl+Z undoes and Ctrl+Y / Ctrl+Shift+Z redo", async ({ page }) => {
    await rename(page, "First");
    await rename(page, "Second");
    await page.getByTestId("studio-canvas").click();

    await page.keyboard.press("Control+Z");
    await expect(nameField(page)).toHaveValue("First");
    await expect(status(page)).toHaveText("Undo: Rename project.");
    await page.keyboard.press("Control+Z");
    await expect(projectTab(page, "Untitled")).toBeVisible();
    // Nothing left to undo: Undo is off, so Ctrl+Z changes nothing.
    await page.keyboard.press("Control+Z");
    await expect(nameField(page)).toHaveValue("Untitled");

    await page.keyboard.press("Control+Y");
    await expect(nameField(page)).toHaveValue("First");
    await page.keyboard.press("Control+Shift+Z");
    await expect(nameField(page)).toHaveValue("Second");
    await expect(status(page)).toHaveText("Redo: Rename project.");
  });

  test("the Edit menu names what Undo and Redo will do", async ({ page }) => {
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /^Undo/ })).toBeDisabled();
    await page.keyboard.press("Escape");

    await rename(page, "Rover");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByRole("menuitem", { name: /Undo Rename project/ }).click();
    await expect(nameField(page)).toHaveValue("Untitled");

    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /Redo Rename project/ })).toBeEnabled();
  });

  test("Ctrl+Z inside the name field undoes typing, not the project", async ({ page }) => {
    await rename(page, "Kept");
    await nameField(page).click();
    await nameField(page).press("End");
    await nameField(page).pressSequentially("xyz");
    await nameField(page).press("Control+Z");
    // The project rename is still there; only the field's own typing was affected.
    await expect(projectTab(page, "Kept")).toBeVisible();
    await expect(nameField(page)).not.toHaveValue("Untitled");
  });

  test("Esc puts the name back and an empty name is refused", async ({ page }) => {
    await nameField(page).fill("Draft");
    await nameField(page).press("Escape");
    await expect(nameField(page)).toHaveValue("Untitled");

    await nameField(page).fill("   ");
    await nameField(page).press("Enter");
    await expect(status(page)).toHaveText("A project name must be 1–100 characters.");
    await expect(nameField(page)).toHaveValue("Untitled");
  });

  test("each project tab has its own undo history", async ({ page }) => {
    await rename(page, "Alpha");
    await page.getByRole("button", { name: "New project" }).click();
    await expect(nameField(page)).toHaveValue("Untitled");
    await page.getByTestId("studio-canvas").click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /^Undo/ })).toBeDisabled();
    await page.keyboard.press("Escape");

    await projectTab(page, "Alpha").click();
    await expect(nameField(page)).toHaveValue("Alpha");
    await page.keyboard.press("Control+Z");
    // Back to its first name; the other project was not touched.
    await expect(nameField(page)).toHaveValue("Untitled");
    await expect(projectTab(page, "Alpha")).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Open projects" }).getByRole("tab")).toHaveCount(
      2,
    );
  });
});
