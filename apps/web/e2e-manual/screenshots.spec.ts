import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const OUT = path.resolve(__dirname, "../../../docs/manual/images");
const shot = (name: string) => path.join(OUT, `${name}.png`);

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.addInitScript((t) => window.localStorage.setItem("robosim-theme", t), theme);
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

test("home page", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/");
  await settle(page);
  await page.screenshot({ path: shot("home-page") });
});

test("theme switcher in dark and light", async ({ page }) => {
  const clip = { x: 0, y: 0, width: 1366, height: 560 };
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  await page.screenshot({ path: shot("theme-dark"), clip });

  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await page.mouse.move(0, 0);
  await settle(page);
  await page.screenshot({ path: shot("theme-light"), clip });
});

test("engineering number fields", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  const field = page.locator("#controls").getByRole("spinbutton", { name: "Resistance" });
  await field.fill("4.7k");
  await field.press("Enter");
  await page.mouse.move(0, 0);
  const row = page.locator("#controls").getByText("Engineering numbers").locator("..");
  await row.screenshot({ path: shot("number-field") });
});

test("workspace: panels, toolbar and inspector", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  const workspace = page.locator("#workspace");
  await workspace.scrollIntoViewIfNeeded();
  // Show a toolbar tooltip in the picture.
  // Hover until the tooltip shows: the page may still shift a little after loading.
  await expect(async () => {
    await page.mouse.move(0, 0);
    await workspace.getByRole("radio", { name: "Wire" }).hover();
    await expect(page.getByRole("tooltip")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await settle(page);
  await workspace.screenshot({ path: shot("workspace") });
});

test.describe("studio workspace", () => {
  test.beforeEach(async ({ page }) => {
    await setTheme(page, "dark");
    await page.goto("/studio");
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
    await settle(page);
  });

  test("overview with status bar", async ({ page }) => {
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByTestId("studio-canvas").hover({ position: { x: 240, y: 120 } });
    await settle(page);
    await page.screenshot({ path: shot("studio-overview") });
    await page.screenshot({
      path: shot("studio-status-bar"),
      clip: { x: 0, y: 768 - 24, width: 1366, height: 24 },
    });
  });

  test("floating group", async ({ page }) => {
    const inspector = page
      .locator(".dv-groupview")
      .filter({ has: page.locator(".dv-tab", { hasText: "Inspector" }) });
    await inspector.getByRole("button", { name: "Float this group" }).click();
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: shot("studio-floating") });
  });

  test("view menu", async ({ page }) => {
    await page.getByRole("menuitem", { name: "View" }).click();
    await expect(page.getByRole("menuitem", { name: "Reset layout" })).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: shot("studio-view-menu"),
      clip: { x: 0, y: 0, width: 640, height: 260 },
    });
  });

  test("command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search commands" }).fill("lay");
    await settle(page);
    await page.screenshot({
      path: shot("command-palette"),
      clip: { x: 300, y: 60, width: 766, height: 460 },
    });
  });

  test("project name and undo", async ({ page }) => {
    const name = page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
    await name.fill("Line follower");
    await name.press("Enter");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /Undo Rename project/ })).toBeVisible();
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: shot("studio-undo") });
  });

  test("file menu", async ({ page }) => {
    await page.getByRole("menuitem", { name: "File" }).click();
    await expect(page.getByRole("menuitem", { name: "Copy share link" })).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: shot("studio-file-menu"),
      clip: { x: 0, y: 0, width: 640, height: 300 },
    });
  });

  test("recent projects window", async ({ page }) => {
    const name = page.locator(".dv-groupview").getByRole("textbox", { name: "Name" });
    await name.fill("Line follower");
    await name.press("Enter");
    await page.getByRole("button", { name: "New project" }).click();
    await name.fill("Robot arm");
    await name.press("Enter");
    await page.keyboard.press("Alt+O");
    const dialog = page.getByRole("dialog", { name: "Recent projects" });
    await expect(dialog.getByRole("listitem")).toHaveCount(2);
    await settle(page);
    await dialog.screenshot({ path: shot("recent-projects") });
  });

  test("simulation running", async ({ page }) => {
    const group = page.getByRole("group", { name: "Simulation" });
    await group.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("sim-status")).toContainText("steps/s");
    await page.waitForTimeout(1800);
    await group.getByRole("button", { name: "Pause" }).click(); // a still frame for the picture
    await expect(page.getByTestId("sim-status")).toContainText("Paused");
    await group.getByRole("button", { name: "Run" }).click();
    await page.waitForTimeout(400);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: shot("simulation-running") });
  });

  test("system information window", async ({ page }) => {
    await page.getByRole("menuitem", { name: "Help" }).click();
    await page.getByRole("menuitem", { name: "System information" }).click();
    const dialog = page.getByRole("dialog", { name: "System information" });
    await expect(dialog).toBeVisible();
    await settle(page);
    await dialog.screenshot({ path: shot("system-info") });
  });

  test("studio error screen", async ({ page }) => {
    // Development-only crash switch (see panel-error-boundary.tsx).
    await page.goto("/studio?crash=studio");
    await expect(page.getByRole("heading", { name: "The studio stopped working" })).toBeVisible();
    // Hide the development-only error badge so the picture shows what users see.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await settle(page);
    await page.screenshot({
      path: shot("studio-error"),
      clip: { x: 383, y: 160, width: 600, height: 440 },
    });
  });

  test("keyboard shortcuts window", async ({ page }) => {
    await page.getByTestId("studio-canvas").click();
    await page.keyboard.press("Control+Slash");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await settle(page);
    await dialog.screenshot({ path: shot("keyboard-shortcuts") });
  });
});

test.describe("schematic canvas", () => {
  /** Canvas point `dx`, `dy` grid steps (19.2 px at 200 %) from the origin at the centre. */
  async function at(page: Page, dx: number, dy: number) {
    const box = await page.getByTestId("studio-canvas").boundingBox();
    if (!box) throw new Error("no layout");
    return { x: box.width / 2 + dx * 19.2, y: box.height / 2 + dy * 19.2 };
  }

  async function place(page: Page, tool: string, dx: number, dy: number, turns = 0) {
    const canvas = page.getByTestId("studio-canvas");
    await page.getByRole("radio", { name: tool }).click();
    await canvas.hover({ position: await at(page, dx, dy) });
    for (let i = 0; i < turns; i++) await page.keyboard.press("r");
    await canvas.click({ position: await at(page, dx, dy) });
    await page.keyboard.press("Escape");
  }

  /** A voltage divider drawn with the real tools: V1, R1, R2 (2.2 kΩ) and two grounds. */
  async function drawDivider(page: Page) {
    await setTheme(page, "dark");
    await page.goto("/studio");
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
    await place(page, "Place DC voltage source", -8, 0);
    await place(page, "Place resistor", -3, -4);
    await place(page, "Place resistor", 2, 0, 1);
    await place(page, "Place ground", -8, 4);
    await place(page, "Place ground", 2, 4);
    const canvas = page.getByTestId("studio-canvas");
    await canvas.click({ position: await at(page, 2, 0) });
    const value = page.getByRole("textbox", { name: "Resistance" });
    await value.fill("2k2");
    await value.press("Enter");
    return canvas;
  }

  test("drawing with a part selected", async ({ page }) => {
    const canvas = await drawDivider(page);
    await canvas.click({ position: await at(page, 2, 0) });
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: shot("schematic-editor") });
  });

  test("placing a part", async ({ page }) => {
    const canvas = await drawDivider(page);
    await page.getByRole("radio", { name: "Place resistor" }).click();
    await canvas.hover({ position: await at(page, 9, -4) });
    await page.keyboard.press("r");
    await canvas.hover({ position: await at(page, 9, -3) });
    await expect(canvas.getByTestId("schematic-ghost")).toBeVisible();
    await settle(page);
    const box = await canvas.boundingBox();
    if (!box) throw new Error("no layout");
    await page.screenshot({ path: shot("schematic-placing"), clip: box });
  });

  test("box selection", async ({ page }) => {
    const canvas = await drawDivider(page);
    await canvas.click({ position: await at(page, 12, 6) }); // nothing selected
    const box = await canvas.boundingBox();
    if (!box) throw new Error("no layout");
    const from = await at(page, -11, -6);
    const to = await at(page, 5, 6);
    await page.mouse.move(box.x + from.x, box.y + from.y);
    await page.mouse.down();
    await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 5 });
    await settle(page);
    await page.screenshot({ path: shot("schematic-box-select"), clip: box });
    await page.mouse.up();
  });

  /** Wires the divider with the wire tool: V1 + → R1, R1 → R2, V1 − → ground, R2 → ground. */
  async function wireDivider(page: Page) {
    const canvas = page.getByTestId("studio-canvas");
    await page.getByTestId("studio-canvas").focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("w");
    const click = async (dx: number, dy: number) =>
      canvas.click({ position: await at(page, dx, dy) });
    await click(-8, -2);
    await click(-8, -4);
    await click(-5, -4); // ends on R1 pin 1
    await click(-1, -4);
    await click(2, -4);
    await click(2, -2); // ends on R2 pin 1
    await click(-8, 2);
    await click(-8, 4); // ends on the ground pin
    await click(2, 2);
    await click(2, 4);
    await expect(canvas.locator("[data-wire]")).toHaveCount(4);
    await page.keyboard.press("Escape");
    return canvas;
  }

  async function canvasClip(page: Page) {
    const box = await page.getByTestId("studio-canvas").boundingBox();
    if (!box) throw new Error("no layout");
    return box;
  }

  test("drawing a wire", async ({ page }) => {
    const canvas = await drawDivider(page);
    await page.getByTestId("studio-canvas").focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("w");
    await canvas.click({ position: await at(page, -8, -2) });
    await canvas.click({ position: await at(page, -8, -4) });
    await canvas.click({ position: await at(page, -5, -4) });
    await canvas.click({ position: await at(page, -1, -4) });
    await canvas.hover({ position: await at(page, 2, -2) });
    await expect(canvas.getByTestId("wire-preview")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: shot("schematic-wiring"), clip: await canvasClip(page) });
  });

  test("rubber-banding while a part is dragged", async ({ page }) => {
    await drawDivider(page);
    await wireDivider(page);
    const box = await canvasClip(page);
    const from = await at(page, 2, 0);
    const to = await at(page, 6, 1);
    await page.mouse.move(box.x + from.x, box.y + from.y);
    await page.mouse.down();
    await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 6 });
    await settle(page);
    await page.screenshot({ path: shot("schematic-rubber-band"), clip: box });
    await page.mouse.up();
  });

  test("net label name box", async ({ page }) => {
    await drawDivider(page);
    await wireDivider(page);
    await page.keyboard.press("l");
    const name = page.getByRole("textbox", { name: "Net label name" });
    await name.fill("VOUT");
    await settle(page);
    await page.screenshot({ path: shot("schematic-label-name"), clip: await canvasClip(page) });
  });

  test("a wire's net in the Inspector", async ({ page }) => {
    const canvas = await drawDivider(page);
    await wireDivider(page);
    await page.keyboard.press("l");
    const name = page.getByRole("textbox", { name: "Net label name" });
    await name.fill("VOUT");
    await name.press("Enter");
    await canvas.click({ position: await at(page, 0, -4) });
    await page.keyboard.press("Escape");
    await canvas.click({ position: await at(page, 2, -3) });
    await expect(page.getByRole("region", { name: "Wire" })).toContainText("VOUT");
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: shot("schematic-net-inspector") });
  });
});

test("schematic symbols: IEC and ANSI", async ({ page }) => {
  await setTheme(page, "dark");
  await page.goto("/ui-kit");
  await settle(page);
  const gallery = page.locator("#schematic-symbols");
  await gallery.scrollIntoViewIfNeeded();
  await settle(page);
  await gallery.screenshot({ path: shot("schematic-symbols") });
});
