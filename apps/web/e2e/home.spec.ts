import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("loads without errors and shows the studio name", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    await expect(page).toHaveTitle("RoboSim Studio");
    await expect(page.getByRole("heading", { level: 1, name: "RoboSim Studio" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Open the studio goes to the studio workspace", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Open the studio" }).first().click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
  });

  test("lists all 10 labs, marked as planned", async ({ page }) => {
    await page.goto("/");
    const labs = page.getByRole("list", { name: "The 10 labs" }).getByRole("listitem");
    await expect(labs).toHaveCount(10);
    await expect(labs.first()).toContainText("Circuit Lab");
    await expect(labs.last()).toContainText("Gesture Control Lab");
    await expect(labs.first()).toContainText("Phase 1 · planned");
  });

  test("shows what works today and links out safely", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("list", { name: "Ready today" }).getByRole("listitem")).toHaveCount(
      6,
    );
    for (const link of await page.locator('a[target="_blank"]').all()) {
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
