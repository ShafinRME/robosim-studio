import { expect, test, type Page } from "@playwright/test";
import { pickPart } from "./part-helpers";

/** Property inspector (Day 14): rows come from the part file; several parts edit together. */

const canvas = (page: Page) => page.getByTestId("studio-canvas");
const selection = (page: Page) => page.getByRole("region", { name: "Selection" });

async function place(page: Page, name: string, ...points: { x: number; y: number }[]) {
  await pickPart(page, name);
  for (const position of points) await canvas(page).click({ position });
  await page.keyboard.press("Escape");
}

test.use({ viewport: { width: 1366, height: 768 } });

test("a resistor shows all its properties, with the allowed range as a hint", async ({ page }) => {
  await page.goto("/studio");
  await place(page, "Resistor", { x: 300, y: 200 });
  await canvas(page).click({ position: { x: 300, y: 200 } });
  await expect(page.getByRole("textbox", { name: "Resistance" })).toHaveValue("1 kΩ");
  await expect(page.getByRole("textbox", { name: "Tolerance" })).toHaveValue("5 %");
  await expect(page.getByRole("textbox", { name: "Power rating" })).toHaveValue("250 mW");
  await expect(page.getByText("Power rating", { exact: true })).toHaveAttribute(
    "title",
    /more than 0 W to 1 kW/,
  );
});

test("the switch turns on and off in the Inspector and is drawn closed", async ({ page }) => {
  await page.goto("/studio");
  await place(page, "Switch (SPST)", { x: 300, y: 200 });
  await canvas(page).click({ position: { x: 300, y: 200 } });
  const closed = page.getByRole("switch", { name: "Closed" });
  await expect(closed).toHaveAttribute("aria-checked", "false");
  const lines = () => canvas(page).locator("[data-part] line").count();
  const open = await lines();
  await closed.click();
  await expect(closed).toHaveAttribute("aria-checked", "true");
  await expect.poll(lines).toBe(open + 1); // the closed artwork has the contact stub
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("menuitem", { name: /Undo Set closed of SW1/ })).toBeVisible();
});

test("several parts of one type are edited together; mixed values say so", async ({ page }) => {
  await page.goto("/studio");
  await place(page, "Resistor", { x: 250, y: 150 }, { x: 250, y: 300 });
  // Give R2 its own value first.
  await canvas(page).click({ position: { x: 250, y: 300 } });
  const resistance = page.getByRole("textbox", { name: "Resistance" });
  await resistance.fill("470");
  await resistance.press("Enter");

  await canvas(page).focus();
  await page.keyboard.press("Control+a");
  await expect(page.getByRole("button", { name: /Selection/ })).toContainText("2 × Resistor");
  await expect(selection(page)).toContainText("R1, R2");
  await expect(resistance).toHaveValue("");
  await expect(resistance).toHaveAttribute("placeholder", "Mixed");
  await resistance.fill("2k2");
  await resistance.press("Enter");
  await expect(canvas(page).getByText("2.2 kΩ")).toHaveCount(2);
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page.getByRole("menuitem", { name: /Undo Set resistance of 2 parts/ }),
  ).toBeVisible();
});

test("the potentiometer's wiper position is typed in percent", async ({ page }) => {
  await page.goto("/studio");
  await place(page, "Potentiometer", { x: 300, y: 220 });
  await canvas(page).click({ position: { x: 300, y: 220 } });
  const wiper = page.getByRole("textbox", { name: "Wiper position" });
  await expect(wiper).toHaveValue("50 %");
  await wiper.fill("25 %");
  await wiper.press("Enter");
  await expect(wiper).toHaveValue("25 %");
  await wiper.fill("150 %");
  await wiper.press("Enter");
  await expect(wiper).toHaveValue("25 %");
  await expect(page.getByRole("contentinfo", { name: "Status bar" })).toContainText("RV1:");
});
