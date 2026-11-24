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
    await expect(resistor.locator("rect:not([fill=transparent])")).toHaveCount(1); // IEC: box
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitemcheckbox", { name: "ANSI symbols" }).click();
    await expect(canvas(page)).toContainText("SCHEMATIC · ANSI");
    await expect(resistor.locator("polyline")).toHaveCount(1); // ANSI: zig-zag
    await expect(resistor.locator("rect:not([fill=transparent])")).toHaveCount(0);

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

test.describe("placing and editing parts", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  /** Canvas point `dx`, `dy` grid steps (100 mil = 19.2 px at 200 %) from the centre (origin). */
  async function at(page: Page, dx: number, dy: number) {
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error("no layout");
    return { x: box.width / 2 + dx * 19.2, y: box.height / 2 + dy * 19.2 };
  }
  const header = (page: Page) => canvas(page).locator("span").filter({ hasText: "SCHEMATIC" });
  const part = (page: Page, name: string) =>
    canvas(page)
      .locator("[data-part]")
      .filter({ has: page.locator(`text="${name}"`) });

  async function placeTwoResistors(page: Page) {
    await page.goto("/studio");
    await expect(zoomLevel(page)).toHaveText("200 %");
    await page.getByRole("radio", { name: "Place resistor" }).click();
    await expect(canvas(page)).toHaveAttribute("data-tool", "place:resistor");
    await canvas(page).click({ position: await at(page, -5, 0) });
    await canvas(page).click({ position: await at(page, 5, 0) });
    await page.keyboard.press("Escape");
    await expect(canvas(page)).toHaveAttribute("data-tool", "select");
    await expect(header(page)).toHaveText("SCHEMATIC · IEC · 2 parts");
  }

  test("places parts on the grid with automatic designators, one undo step each", async ({
    page,
  }) => {
    await placeTwoResistors(page);
    await expect(part(page, "R1")).toHaveCount(1);
    await expect(part(page, "R2")).toHaveCount(1);
    await expect(canvas(page).getByTestId("schematic-parts")).toContainText("1 kΩ");

    await page.keyboard.press("Control+z");
    await expect(header(page)).toHaveText("SCHEMATIC · IEC · 1 part");
    await page.keyboard.press("Control+y");
    await expect(header(page)).toHaveText("SCHEMATIC · IEC · 2 parts");
  });

  test("turns the part while placing (R) and shows a ghost", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("radio", { name: "Place ground" }).click();
    await canvas(page).hover({ position: await at(page, 0, 0) });
    await expect(canvas(page).getByTestId("schematic-ghost")).toBeVisible();
    await page.keyboard.press("r");
    await page.keyboard.press("r");
    await canvas(page).click({ position: await at(page, 0, 0) });
    await page.keyboard.press("Escape");
    await canvas(page).click({ position: await at(page, 0, -2) }); // the ground's bars (rotated 180°)
    await expect(page.getByRole("textbox", { name: "Part name" })).toHaveValue("GND1");
    await expect(page.getByText("180°")).toBeVisible();
  });

  test("selects, edits the value in the Inspector and refuses a bad value", async ({ page }) => {
    await placeTwoResistors(page);
    await canvas(page).click({ position: await at(page, -5, 0) });
    await expect(header(page)).toContainText("1 selected");
    const value = page.getByRole("textbox", { name: "Resistance" });
    await expect(value).toHaveValue("1 kΩ");

    await value.fill("4k7");
    await value.press("Enter");
    await expect(part(page, "R1")).toContainText("4.7 kΩ");

    await value.fill("0");
    await value.press("Enter");
    await expect(page.getByRole("contentinfo", { name: "Status bar" })).toContainText(
      "R1: Resistance must be more than 0 Ω.",
    );
    await expect(value).toHaveValue("4.7 kΩ");
  });

  test("box-selects, rotates, mirrors, nudges and deletes — all undoable", async ({ page }) => {
    await placeTwoResistors(page);
    // Left → right box around both parts.
    const from = await at(page, -9, -3);
    const to = await at(page, 9, 3);
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error("no layout");
    await page.mouse.move(box.x + from.x, box.y + from.y);
    await page.mouse.down();
    await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 5 });
    await expect(canvas(page).getByTestId("selection-box")).toBeVisible();
    await page.mouse.up();
    await expect(header(page)).toContainText("2 selected");

    await page.keyboard.press("r");
    await page.keyboard.press("x");
    await page.keyboard.press("ArrowDown");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /Undo Move 2 parts/ })).toBeVisible();
    await page.keyboard.press("Escape");

    await canvas(page).focus();
    await page.keyboard.press("Delete");
    await expect(header(page)).toHaveText("SCHEMATIC · IEC · 0 parts");
    await page.keyboard.press("Control+z");
    await expect(header(page)).toHaveText("SCHEMATIC · IEC · 2 parts");
  });

  test("drags a part by whole grid steps", async ({ page }) => {
    await placeTwoResistors(page);
    await canvas(page).click({ position: await at(page, -5, 0) });
    const position = page.getByText(/^-12\.70, 0\.00 mm$/);
    await expect(position).toBeVisible();

    const box = await canvas(page).boundingBox();
    if (!box) throw new Error("no layout");
    const start = await at(page, -5, 0);
    const end = await at(page, -5, 3.2); // snaps to 3 grid steps down
    await page.mouse.move(box.x + start.x, box.y + start.y);
    await page.mouse.down();
    await page.mouse.move(box.x + end.x, box.y + end.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText(/^-12\.70, 7\.62 mm$/)).toBeVisible();
  });

  test("Ctrl+A selects everything, Esc clears the selection", async ({ page }) => {
    await placeTwoResistors(page);
    await canvas(page).focus();
    await page.keyboard.press("Control+a");
    await expect(header(page)).toContainText("2 selected");
    await page.keyboard.press("Escape");
    await expect(header(page)).not.toContainText("selected");
  });
});

test.describe("wiring (ADR 009)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  /** Canvas point `dx`, `dy` grid steps (100 mil = 19.2 px at 200 %) from the origin. */
  async function at(page: Page, dx: number, dy: number) {
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error("no layout");
    return { x: box.width / 2 + dx * 19.2, y: box.height / 2 + dy * 19.2 };
  }
  const wires = (page: Page) => canvas(page).locator("[data-wire]");
  const pinCircles = (page: Page) => canvas(page).locator('[data-part] circle[r="12"]');

  /** V1 at (−5, 0): + at (−5, −2), − at (−5, 2). R1 at (0, −2): pins at (−2, −2) and (2, −2). */
  async function setUp(page: Page) {
    await page.goto("/studio");
    await expect(zoomLevel(page)).toHaveText("200 %");
    await page.getByRole("radio", { name: "Place DC voltage source" }).click();
    await canvas(page).click({ position: await at(page, -5, 0) });
    await page.getByRole("radio", { name: "Place resistor" }).click();
    await canvas(page).click({ position: await at(page, 0, -2) });
    await page.keyboard.press("Escape");
    await expect(pinCircles(page)).toHaveCount(4);
    await page.keyboard.press("w");
    await expect(canvas(page)).toHaveAttribute("data-tool", "wire");
  }

  test("draws a wire that ends by itself on a pin; connected pins lose their circle", async ({
    page,
  }) => {
    await setUp(page);
    await canvas(page).click({ position: await at(page, -5, -2) });
    await expect(canvas(page).getByTestId("wire-preview")).toBeVisible();
    await canvas(page).click({ position: await at(page, -2, -2) });
    await expect(wires(page)).toHaveCount(1);
    await expect(wires(page).first()).toHaveAttribute("points", "-500,-200 -200,-200");
    await expect(canvas(page).getByTestId("wire-preview")).toHaveCount(0);
    await expect(pinCircles(page)).toHaveCount(2);

    await page.keyboard.press("Control+z");
    await expect(wires(page)).toHaveCount(0);
    await expect(pinCircles(page)).toHaveCount(4);
  });

  test("routes an L-shape with corners; / switches the corner, Backspace and Enter", async ({
    page,
  }) => {
    await setUp(page);
    // From V1 − (−5, 2) towards (3, 5): horizontal first → corner at (3, 2).
    await canvas(page).click({ position: await at(page, -5, 2) });
    await canvas(page).hover({ position: await at(page, 3, 5) });
    await page.keyboard.press("/"); // vertical first → corner at (−5, 5)
    await canvas(page).click({ position: await at(page, 3, 5) });
    await canvas(page).click({ position: await at(page, 6, 5) });
    await page.keyboard.press("Backspace"); // drop the last point again
    await page.keyboard.press("Enter");
    await expect(wires(page)).toHaveCount(1);
    await expect(wires(page).first()).toHaveAttribute("points", "-500,200 -500,500 300,500");
  });

  test("a wire ending on another wire makes a T-junction with a dot; crossings do not", async ({
    page,
  }) => {
    await setUp(page);
    // Wire A: from R1 pin 2 (2, −2) down to (2, 4), ended with a double-click.
    await canvas(page).click({ position: await at(page, 2, -2) });
    await canvas(page).dblclick({ position: await at(page, 2, 4) });
    await expect(wires(page)).toHaveCount(1);
    // Wire B: from V1 − (−5, 2) to the middle of A at (2, 2): ends there by itself, with a dot.
    await canvas(page).click({ position: await at(page, -5, 2) });
    await canvas(page).click({ position: await at(page, 2, 2) });
    await expect(wires(page)).toHaveCount(2);
    await expect(canvas(page).locator('[data-junction="200,200"]')).toHaveCount(1);
    // Wire C crosses A at (2, 0) without ending on it: no dot.
    await canvas(page).click({ position: await at(page, 0, 0) });
    await canvas(page).dblclick({ position: await at(page, 4, 0) });
    await expect(wires(page)).toHaveCount(3);
    await expect(canvas(page).locator("[data-junction]")).toHaveCount(1);
  });

  test("Esc cancels the wire being drawn, a second Esc leaves the tool", async ({ page }) => {
    await setUp(page);
    await canvas(page).click({ position: await at(page, -5, -2) });
    await page.keyboard.press("Escape");
    await expect(canvas(page).getByTestId("wire-preview")).toHaveCount(0);
    await expect(canvas(page)).toHaveAttribute("data-tool", "wire");
    await page.keyboard.press("Escape");
    await expect(canvas(page)).toHaveAttribute("data-tool", "select");
    await expect(wires(page)).toHaveCount(0);
  });
});
