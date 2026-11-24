import { expect, test, type Page } from "@playwright/test";

/** Schematic canvas (ADR 008): grid, zoom, pan, fit, symbol style and units. */

const canvas = (page: Page) => page.getByTestId("studio-canvas");
const zoomLevel = (page: Page) => page.getByTestId("zoom-level");
const percentOf = async (page: Page) =>
  Number((await zoomLevel(page).textContent())?.replace(/\D/g, ""));

/** A shared project with a resistor and a battery (a share link, as a learner would open it). */
async function openDemo(page: Page) {
  await page.goto("/studio");
  await expect(canvas(page)).toBeVisible();
  const url = await page.evaluate(async () => {
    // Build the link with the studio's own share format, inside the page.
    const project = {
      format: "robosim-project",
      version: 2,
      id: "e2e-demo",
      name: "Canvas demo",
      lab: "circuit",
      createdAt: "2026-11-24T00:00:00.000Z",
      updatedAt: "2026-11-24T00:00:00.000Z",
      parts: [
        {
          id: "r1",
          type: "resistor",
          name: "R1",
          x: 0,
          y: 0,
          rotation: 0,
          flip: false,
          props: { resistance: 4700 },
        },
        {
          id: "v1",
          type: "source.dc-voltage",
          name: "V1",
          x: -600,
          y: 300,
          rotation: 0,
          flip: false,
          props: { voltage: 9 },
        },
      ],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(project));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = "";
    for (const b of compressed) binary += String.fromCharCode(b);
    const token = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `/studio#share=${token}`;
  });
  // A share link is read when the studio loads: leave the studio, then open the link.
  await page.goto("/");
  await page.goto(url);
  await expect(canvas(page)).toContainText(/SCHEMATIC · (IEC|ANSI) · 2 parts/);
}

test.describe("schematic canvas", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("shows the grid, the zoom level and an empty project", async ({ page }) => {
    await page.goto("/studio");
    await expect(canvas(page)).toBeVisible();
    await expect(zoomLevel(page)).toHaveText("200 %");
    await expect(canvas(page).locator("svg pattern")).toHaveCount(2);
  });

  test("zooms with the toolbar, the keyboard and the mouse wheel", async ({ page }) => {
    await page.goto("/studio");
    await expect(zoomLevel(page)).toHaveText("200 %");

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoomLevel(page)).toHaveText("300 %");
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(zoomLevel(page)).toHaveText("150 %");
    await page.getByRole("button", { name: "Zoom to 100 %" }).click();
    await expect(zoomLevel(page)).toHaveText("100 %");

    await canvas(page).click({ position: { x: 300, y: 200 } });
    await page.keyboard.press("+");
    await expect(zoomLevel(page)).toHaveText("125 %");
    await page.keyboard.press("-");
    await expect(zoomLevel(page)).toHaveText("100 %");

    await canvas(page).hover({ position: { x: 300, y: 200 } });
    await page.mouse.wheel(0, -300);
    await expect.poll(() => percentOf(page)).toBeGreaterThan(100);
    // The page itself never scrolls.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("draws the parts of a project and fits them with F", async ({ page }) => {
    await openDemo(page);
    const parts = canvas(page).getByTestId("schematic-parts");
    await expect(parts.locator("[data-part]")).toHaveCount(2);
    await expect(parts).toContainText("R1");
    await expect(parts).toContainText("4.7 kΩ");
    await expect(parts).toContainText("9 V");

    const fitted = await percentOf(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    expect(await percentOf(page)).toBeGreaterThan(fitted);
    await canvas(page).click({ position: { x: 20, y: 300 } });
    await page.keyboard.press("f");
    await expect.poll(() => percentOf(page)).toBe(fitted);
  });

  test("pans with the middle mouse button", async ({ page }) => {
    await openDemo(page);
    const part = canvas(page).locator('[data-part="r1"]');
    const before = await part.boundingBox();
    const box = await canvas(page).boundingBox();
    if (!before || !box) throw new Error("no layout");
    await page.mouse.move(box.x + 300, box.y + 200);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(box.x + 380, box.y + 240, { steps: 4 });
    await page.mouse.up({ button: "middle" });
    const after = await part.boundingBox();
    expect(after?.x).toBeCloseTo(before.x + 80, 0);
    expect(after?.y).toBeCloseTo(before.y + 40, 0);
  });

  test("switches between IEC and ANSI symbols and remembers it", async ({ page }) => {
    await openDemo(page);
    const resistor = canvas(page).locator('[data-part="r1"]');
    await expect(resistor.locator("rect")).toHaveCount(1); // IEC: box
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitemcheckbox", { name: "ANSI symbols" }).click();
    await expect(canvas(page)).toContainText("SCHEMATIC · ANSI");
    await expect(resistor.locator("polyline")).toHaveCount(1); // ANSI: zig-zag
    await expect(resistor.locator("rect")).toHaveCount(0);

    await page.reload();
    await expect(canvas(page)).toContainText("SCHEMATIC · ANSI");
  });

  test("shows the cursor position in mm or inches", async ({ page }) => {
    await page.goto("/studio");
    const cursor = page.getByTestId("status-cursor");
    // At 200 % one 100-mil grid step is 19.2 px; move from the centre (origin) by 2 steps right.
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error("no layout");
    await page.mouse.move(box.x + box.width / 2 + 38.4, box.y + box.height / 2);
    await expect(cursor).toHaveText(/X 5\.08 mm\s+Y 0\.00 mm/);
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Units: inches" }).click();
    await page.mouse.move(box.x + box.width / 2 + 38.4, box.y + box.height / 2 + 1);
    await expect(cursor).toHaveText(/X 0\.200 in\s+Y 0\.000 in/);
  });
});
