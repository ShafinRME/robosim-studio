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

  test("lists all 10 labs", async ({ page }) => {
    await page.goto("/");
    const labs = page.getByRole("listitem");
    await expect(labs).toHaveCount(10);
    await expect(labs.first()).toContainText("Circuit Lab");
    await expect(labs.last()).toContainText("Gesture Control Lab");
  });
});
