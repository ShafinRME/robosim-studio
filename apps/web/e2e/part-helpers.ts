import { expect, type Page } from "@playwright/test";

/**
 * Starts placing a part the way a user does since Day 14: Parts panel → search its name → Enter.
 * Not a spec file: shared by the e2e and manual-screenshot tests.
 */
export async function pickPart(page: Page, name: string): Promise<void> {
  const drawer = page.getByTestId("parts-drawer");
  if (!(await drawer.isVisible())) await page.locator(".dv-tab", { hasText: "Parts" }).click();
  const search = page.getByRole("combobox", { name: "Search parts" });
  await search.fill(name);
  await expect(drawer.getByRole("option").first()).toContainText(name);
  await search.press("Enter");
  await expect(page.getByTestId("studio-canvas")).toHaveAttribute("data-tool", /^place:/);
}
