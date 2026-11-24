import { expect, test } from "@playwright/test";

test.describe("theme switcher", () => {
  test("defaults to dark, switches to light and remembers the choice", async ({ page }) => {
    await page.goto("/ui-kit");
    const html = page.locator("html");
    await expect(html).toHaveClass(/\bdark\b/);

    const themes = page.getByRole("radiogroup", { name: "Colour theme" });
    await themes.getByRole("radio", { name: "Light" }).click();
    await expect(html).toHaveClass(/\blight\b/);
    await expect(themes.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.reload();
    await expect(html).toHaveClass(/\blight\b/);
  });

  test("can be operated with the keyboard", async ({ page }) => {
    await page.goto("/ui-kit");
    const dark = page.getByRole("radio", { name: "Dark" });
    await dark.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
  });
});
