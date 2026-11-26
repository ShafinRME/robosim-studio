import { expect, test, type Page } from "@playwright/test";

/** Parts drawer (ADR 010): browse, search (also by value) and place by click or keyboard. */

const drawer = (page: Page) => page.getByTestId("parts-drawer");
const search = (page: Page) => page.getByRole("combobox", { name: "Search parts" });
const options = (page: Page) => drawer(page).getByRole("option");
const canvas = (page: Page) => page.getByTestId("studio-canvas");
const header = (page: Page) => canvas(page).locator("span").filter({ hasText: "SCHEMATIC" });

async function open(page: Page) {
  await page.goto("/studio");
  await page.locator(".dv-tab", { hasText: "Parts" }).click();
  await expect(drawer(page)).toBeVisible();
}

test.use({ viewport: { width: 1366, height: 768 } });

test("lists every part by category with its symbol", async ({ page }) => {
  await open(page);
  await expect(options(page)).toHaveCount(6);
  for (const heading of ["Sources", "Power & ground", "Passives", "Switches & relays"]) {
    await expect(drawer(page).getByText(heading, { exact: true })).toBeVisible();
  }
  await expect(drawer(page).locator('[data-part-type="switch.spst"] svg')).toBeVisible();
  await expect(drawer(page)).toContainText("6 parts");
});

test("search filters as you type; Esc clears", async ({ page }) => {
  await open(page);
  await search(page).fill("pot");
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toContainText("Potentiometer");
  await search(page).fill("banana");
  await expect(drawer(page)).toContainText("No parts match “banana”");
  await search(page).press("Escape");
  await expect(search(page)).toHaveValue("");
  await expect(options(page)).toHaveCount(6);
});

test("typing a value places the part with that value (keyboard only)", async ({ page }) => {
  await open(page);
  await search(page).fill("10k");
  await expect(options(page).first()).toContainText("Resistor");
  await expect(options(page).first()).toContainText("10 kΩ");
  await search(page).press("Enter");
  await expect(canvas(page)).toHaveAttribute("data-tool", "place:resistor");
  await canvas(page).click({ position: { x: 300, y: 200 } });
  await page.keyboard.press("Escape");
  await expect(header(page)).toContainText("1 part");
  await expect(canvas(page).locator("[data-part]")).toContainText("10 kΩ");
});

test("arrow keys choose a part, click places a new part type", async ({ page }) => {
  await open(page);
  await search(page).fill("switch");
  await search(page).press("ArrowDown"); // stays on the only match
  await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
  await options(page).first().click();
  await expect(canvas(page)).toHaveAttribute("data-tool", "place:switch.spst");
  await canvas(page).click({ position: { x: 300, y: 200 } });
  await page.keyboard.press("Escape");
  await expect(canvas(page).locator("[data-part]")).toContainText("SW1");
});
