import { expect, test } from "@playwright/test";

test.describe("error screens", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("an unknown address shows Page not found (404)", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found · RoboSim Studio");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    await page.getByRole("link", { name: "Open the studio" }).click();
    await expect(page).toHaveURL(/\/studio$/);
  });

  test.describe("crashes (development builds only)", () => {
    // The ?crash= switch is compiled out of production builds, which CI tests.
    test.skip(!!process.env.CI, "the crash switch exists only in development builds");

    test("a crashing panel stays inside its panel", async ({ page }) => {
      await page.goto("/studio?crash=inspector");
      await expect(
        page.getByRole("alert").filter({ hasText: "The Inspector panel stopped working." }),
      ).toBeVisible();
      // The rest of the studio still works.
      await expect(page.getByTestId("studio-canvas")).toBeVisible();
      await page
        .getByRole("group", { name: "Simulation" })
        .getByRole("button", { name: "Run" })
        .click();
      await expect(page.getByTestId("sim-status")).toContainText("Running");
    });

    test("a crashing studio shows a safe way back", async ({ page }) => {
      await page.goto("/studio?crash=studio");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "The studio stopped working",
      );
      await expect(page.getByText("Your projects are safe:")).toBeVisible();
      await expect(page.getByRole("button", { name: "Reload the studio" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Report a problem" })).toHaveAttribute(
        "rel",
        "noopener noreferrer",
      );

      await page.goto("/studio"); // without the switch the studio works again
      await expect(page.getByTestId("studio-canvas")).toBeVisible();
    });
  });
});
