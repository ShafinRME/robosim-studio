import { expect, test, type Page } from "@playwright/test";

const nameField = (page: Page) =>
  page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
const tabs = (page: Page) => page.getByRole("tablist", { name: "Open projects" }).getByRole("tab");
const status = (page: Page) =>
  page.getByRole("contentinfo", { name: "Status bar" }).getByRole("status");

async function rename(page: Page, name: string) {
  await nameField(page).fill(name);
  await nameField(page).press("Enter");
}

async function fileMenu(page: Page, item: string) {
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.describe("share links", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("a copied share link opens a copy of the project", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/studio");
    await rename(page, "Shared rover");

    await fileMenu(page, "Copy share link");
    await expect(status(page)).toHaveText(
      "Share link copied. Anyone with the link can open a copy of this project.",
    );
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/studio#share=[A-Za-z0-9_-]+$/);

    // Someone else opens the link: a fresh browser with no saved projects.
    const other = await context.browser()!.newPage();
    await other.goto(link);
    await expect(
      other.getByRole("contentinfo", { name: "Status bar" }).getByRole("status"),
    ).toHaveText("Opened the shared project “Shared rover”.");
    await expect(other.getByRole("tablist", { name: "Open projects" }).getByRole("tab")).toHaveText(
      ["Untitled", "Shared rover"],
    );
    // The link is removed from the address bar, so a reload does not open it again.
    expect(new URL(other.url()).hash).toBe("");
    await other.reload();
    await expect(
      other.getByRole("tablist", { name: "Open projects" }).getByRole("tab"),
    ).toHaveCount(2);
    await other.close();
  });

  test("a damaged link is refused with a message", async ({ page }) => {
    await page.goto("/studio#share=not-a-real-project");
    await expect(status(page)).toHaveText(
      "This share link could not be opened: the link is damaged.",
    );
    await expect(tabs(page)).toHaveCount(1);
  });
});

test.describe("recent projects", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(nameField(page)).toHaveValue("Untitled");
  });

  test("lists saved projects and reopens a closed one", async ({ page }) => {
    await rename(page, "Arm");
    await page.getByRole("button", { name: "New project" }).click();
    await rename(page, "Rover");
    await page.getByRole("button", { name: "Close Arm" }).click();
    await expect(tabs(page)).toHaveText(["Rover"]);

    await page.keyboard.press("Alt+O");
    const dialog = page.getByRole("dialog", { name: "Recent projects" });
    const list = dialog.getByRole("list", { name: "Saved projects" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").first()).toContainText("Rover");
    await expect(list.getByRole("listitem").first()).toContainText("open");

    await dialog.getByRole("button", { name: "Open Arm" }).click();
    await expect(dialog).toBeHidden();
    await expect(tabs(page)).toHaveText(["Rover", "Arm"]);
    await expect(nameField(page)).toHaveValue("Arm");
  });

  test("deletes a project after a second click", async ({ page }) => {
    await rename(page, "Scrap");
    await fileMenu(page, "Recent projects…");
    const dialog = page.getByRole("dialog", { name: "Recent projects" });
    await dialog.getByRole("button", { name: "Delete Scrap" }).click();
    await expect(dialog.getByRole("listitem")).toHaveCount(1); // not yet deleted
    await dialog.getByRole("button", { name: "Confirm: delete Scrap" }).click();
    await expect(dialog.getByText("No saved projects yet.")).toBeVisible();

    // The open window hides the page from assistive tech: check the page after closing it.
    await page.keyboard.press("Escape");
    await expect(status(page)).toHaveText("Deleted “Scrap”.");
    // It was open: its tab closed too.
    await expect(tabs(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Recent projects" })).toBeVisible();
    await page.reload();
    await expect(tabs(page)).toHaveText(["Untitled"]);
  });
});
