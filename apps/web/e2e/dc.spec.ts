import { expect, test, type Page } from "@playwright/test";
import { pickPart } from "./part-helpers";

/** Live DC results (ADR 011): solved in the analysis worker, shown on the schematic. */

const canvas = (page: Page) => page.getByTestId("studio-canvas");
const status = (page: Page) => page.getByTestId("dc-status");
/** The voltage tag whose text is exactly `text` ("5 V" must not match "2.5 V"). */
const tag = (page: Page, text: string) =>
  canvas(page)
    .locator("[data-net-voltage]")
    .filter({ has: page.getByText(text, { exact: true }) });

/** Canvas point `dx`, `dy` grid steps (100 mil = 19.2 px at 200 %) from the origin. */
async function at(page: Page, dx: number, dy: number) {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error("no layout");
  return { x: box.width / 2 + dx * 19.2, y: box.height / 2 + dy * 19.2 };
}

/**
 * 5 V source, R1 and R2 (1 kΩ each) as a divider, two grounds touching the pins directly:
 * V1 at (−5, 0), R1 at (0, −2), R2 upright at (4, 0); wires V1+ → R1 and R1 → R2.
 */
async function drawDivider(page: Page) {
  await page.goto("/studio");
  const place = async (name: string, dx: number, dy: number, turns = 0) => {
    await pickPart(page, name);
    await canvas(page).hover({ position: await at(page, dx, dy) });
    for (let i = 0; i < turns; i++) await page.keyboard.press("r");
    await canvas(page).click({ position: await at(page, dx, dy) });
    await page.keyboard.press("Escape");
  };
  await place("DC voltage source", -5, 0);
  await place("Resistor", 0, -2);
  await place("Resistor", 4, 0, 1);
  await place("Ground", -5, 2);
  await place("Ground", 4, 2);
  await canvas(page).focus();
  await page.keyboard.press("w");
  for (const [dx, dy] of [
    [-5, -2],
    [-2, -2],
    [2, -2],
    [4, -2],
  ] as const) {
    await canvas(page).click({ position: await at(page, dx, dy) });
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

test.use({ viewport: { width: 1366, height: 768 } });

test("a divider is solved live: net voltages, V / I / P in the Inspector", async ({ page }) => {
  await drawDivider(page);
  await expect(status(page)).toHaveAttribute("data-state", "success");
  await expect(status(page)).toContainText("DC · solved");
  await expect(tag(page, "5 V")).toHaveCount(1);
  await expect(tag(page, "2.5 V")).toHaveCount(1);

  await canvas(page).click({ position: await at(page, 0, -2) });
  await expect(page.locator('[data-readout="voltage"]')).toHaveText("2.5 V");
  await expect(page.locator('[data-readout="current"]')).toHaveText("2.5 mA");
  await expect(page.locator('[data-readout="power"]')).toHaveText("6.25 mW");

  // Change R2 and the results follow by themselves.
  await canvas(page).click({ position: await at(page, 4, 0) });
  const resistance = page.getByRole("textbox", { name: "Resistance" });
  await resistance.fill("4k");
  await resistance.press("Enter");
  await expect(tag(page, "4 V")).toHaveCount(1);
  await expect(page.locator('[data-readout="current"]')).toHaveText("1 mA");
});

test("a circuit that cannot be solved says why and marks the part", async ({ page }) => {
  await drawDivider(page);
  await expect(status(page)).toContainText("DC · solved");
  // Delete both grounds: there is no 0 V reference any more.
  await canvas(page).click({ position: await at(page, -5, 2.8) });
  await page.keyboard.press("Delete");
  await canvas(page).click({ position: await at(page, 4, 2.8) });
  await page.keyboard.press("Delete");
  await expect(status(page)).toHaveAttribute("data-state", "danger");
  await expect(canvas(page).locator("[data-net-voltage]")).toHaveCount(0);
  await status(page).click();
  await expect(page.getByRole("list", { name: "Circuit problems" })).toContainText(/ground/i);
  // Undo brings the grounds and the results back.
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(status(page)).toHaveAttribute("data-state", "success");
});

test("an overloaded resistor gets a rating warning and an amber halo", async ({ page }) => {
  await drawDivider(page);
  await canvas(page).click({ position: await at(page, 0, -2) });
  const resistance = page.getByRole("textbox", { name: "Resistance" });
  await resistance.fill("10");
  await resistance.press("Enter");
  await canvas(page).click({ position: await at(page, 4, 0) });
  await resistance.fill("10");
  await resistance.press("Enter");
  // 5 V across 20 Ω: 1.25 W in each resistor, rated 250 mW.
  await expect(status(page)).toHaveAttribute("data-state", "warning");
  await expect(canvas(page).locator('[data-problem="warning"]')).toHaveCount(2);
  await status(page).click();
  await expect(page.getByRole("list", { name: "Circuit problems" })).toContainText(
    "is beyond its rating",
  );
});

test("View → Show DC results hides and shows the results", async ({ page }) => {
  await drawDivider(page);
  await expect(tag(page, "2.5 V")).toHaveCount(1);
  await page.getByRole("menuitem", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Show DC results" }).click();
  await expect(canvas(page).locator("[data-net-voltage]")).toHaveCount(0);
  await expect(status(page)).toHaveCount(0);
  await page.getByRole("menuitem", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Show DC results" }).click();
  await expect(tag(page, "2.5 V")).toHaveCount(1);
});
