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
    await page.getByRole("link", { name: "Open the studio" }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
  });

  test("lists all 10 labs", async ({ page }) => {
    await page.goto("/");
    const labs = page.getByRole("listitem");
    await expect(labs).toHaveCount(10);
    await expect(labs.first()).toContainText("Circuit Lab");
    await expect(labs.last()).toContainText("Gesture Control Lab");
  });
});
