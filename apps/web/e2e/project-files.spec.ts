import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const nameField = (page: Page) =>
  page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
const tabs = (page: Page) => page.getByRole("tablist", { name: "Open projects" }).getByRole("tab");
const status = (page: Page) =>
  page.getByRole("contentinfo", { name: "Status bar" }).getByRole("status");

async function fileMenu(page: Page, item: string) {
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.describe(".rsim export and import", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(nameField(page)).toHaveValue("Untitled");
  });

  test("a project exported as .rsim imports back as a new project", async ({ page }) => {
    await nameField(page).fill("Line follower");
    await nameField(page).press("Enter");

    const download = page.waitForEvent("download");
    await fileMenu(page, "Export project");
    const file = await download;
    expect(file.suggestedFilename()).toBe("line-follower.rsim");
    await expect(status(page)).toHaveText("Exported “Line follower” as line-follower.rsim.");
    const bytes = await readFile(await file.path());
    expect([...bytes.subarray(0, 2)]).toEqual([0x50, 0x4b]); // "PK": a zip file

    const chooser = page.waitForEvent("filechooser");
    await fileMenu(page, "Import project…");
    await (
      await chooser
    ).setFiles({
      name: "line-follower.rsim",
      mimeType: "application/zip",
      buffer: bytes,
    });
    await expect(status(page)).toHaveText("Imported “Line follower”.");
    // A second tab with the same name: the import is a copy, the original is untouched.
    await expect(tabs(page)).toHaveText(["Line follower", "Line follower"]);
    await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "true");

    await page.reload();
    await expect(tabs(page)).toHaveCount(2);
  });

  test("a file that is not a project is refused with a message", async ({ page }) => {
    await page.getByTestId("import-project-input").setInputFiles({
      name: "notes.rsim",
      mimeType: "application/zip",
      buffer: Buffer.from("this is not a zip"),
    });
    await expect(status(page)).toHaveText(
      "“notes.rsim” could not be imported: not a RoboSim Studio file.",
    );
    await expect(tabs(page)).toHaveCount(1);
  });
});
