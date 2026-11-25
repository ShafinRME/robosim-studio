import { expect, test, type Page } from "@playwright/test";

/**
 * Day 12 "done when": 50 parts can be placed and moved smoothly — also in Low-end mode.
 * Timing test: runs alone, after the others (the "isolated" project in playwright.config.ts).
 */

const canvas = (page: Page) => page.getByTestId("studio-canvas");
const header = (page: Page) => canvas(page).locator("span").filter({ hasText: "SCHEMATIC" });

type FrameReport = { frames: number; worstGap: number; longTasks: number[] };

/** Starts counting frames and long tasks on the main thread for `ms`. */
function measure(page: Page, ms: number): Promise<FrameReport> {
  return page.evaluate(
    (duration) =>
      new Promise<FrameReport>((resolve) => {
        const longTasks: number[] = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(Math.round(entry.duration));
        });
        observer.observe({ type: "longtask", buffered: false });
        let frames = 0;
        let worstGap = 0;
        let last = performance.now();
        const end = last + duration;
        const frame = (now: number) => {
          frames++;
          worstGap = Math.max(worstGap, now - last);
          last = now;
          if (now < end) requestAnimationFrame(frame);
          else {
            observer.disconnect();
            resolve({ frames, worstGap: Math.round(worstGap), longTasks });
          }
        };
        requestAnimationFrame(frame);
      }),
    ms,
  );
}

/** Moves the mouse along a path at ~60 events per second for `ms` while a button may be held. */
async function sweep(page: Page, from: { x: number; y: number }, ms: number) {
  const start = Date.now();
  for (let i = 0; Date.now() - start < ms; i++) {
    const t = i / 30;
    await page.mouse.move(from.x + Math.sin(t) * 120, from.y + Math.cos(t) * 60);
    await page.waitForTimeout(16);
  }
}

async function placeFifty(page: Page) {
  await page.goto("/studio");
  await expect(header(page)).toHaveText("SCHEMATIC · IEC · 0 parts");
  await page.getByRole("button", { name: "Zoom to 100 %" }).click();
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error("no layout");
  // 10 × 5 grid of resistors, 500 mil apart (48 px at 100 %), centred on the origin.
  await page.getByRole("radio", { name: "Place resistor" }).click();
  const started = Date.now();
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      await canvas(page).click({
        position: { x: box.width / 2 + (col - 4.5) * 48, y: box.height / 2 + (row - 2) * 38.4 },
      });
    }
  }
  await page.keyboard.press("Escape");
  await expect(header(page)).toHaveText("SCHEMATIC · IEC · 50 parts");
  return { box, placeMs: Date.now() - started };
}

async function dragAllAndPan(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
) {
  await page.waitForTimeout(500);
  const idle = await measure(page, 2000);

  // Select all 50 and drag them around for 2 s.
  await canvas(page).focus();
  await page.keyboard.press("Control+a");
  await expect(header(page)).toContainText("50 selected");
  const grab = { x: box.x + box.width / 2 - 4.5 * 48, y: box.y + box.height / 2 - 2 * 38.4 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  const dragging = measure(page, 2000);
  await sweep(page, grab, 2000);
  const drag = await dragging;
  await page.mouse.up();

  // Pan with the middle button for 2 s.
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down({ button: "middle" });
  const panningFrames = measure(page, 2000);
  await sweep(page, centre, 2000);
  const pan = await panningFrames;
  await page.mouse.up({ button: "middle" });
  return { idle, drag, pan };
}

function check(label: string, idle: FrameReport, busy: FrameReport) {
  test.info().annotations.push({
    type: "jank check",
    description: `${label}: frames in 2 s ${idle.frames} idle → ${busy.frames}; worst gap ${busy.worstGap} ms; long tasks ${JSON.stringify(busy.longTasks)}`,
  });
  expect(busy.frames, label).toBeGreaterThanOrEqual(idle.frames * 0.75);
  expect(busy.worstGap, label).toBeLessThan(150);
  expect(
    busy.longTasks.filter((ms) => ms >= 100),
    label,
  ).toEqual([]);
}

test.describe.configure({ mode: "serial" });

test.describe("schematic performance (50 parts)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("places, drags and pans 50 parts smoothly", async ({ page }) => {
    const { box, placeMs } = await placeFifty(page);
    test
      .info()
      .annotations.push({ type: "placing", description: `50 clicks placed in ${placeMs} ms` });
    expect(placeMs).toBeLessThan(20_000);

    const { idle, drag, pan } = await dragAllAndPan(page, box);
    check("drag 50 parts", idle, drag);
    check("pan 50 parts", idle, pan);
    // The drag ended as one undoable move of all 50 parts.
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menuitem", { name: /Undo Move 50 parts/ })).toBeVisible();
  });

  test("stays smooth in Low-end mode", async ({ page }) => {
    await page.goto("/studio");
    const lowEnd = page
      .getByRole("contentinfo", { name: "Status bar" })
      .getByRole("button", { name: /Low-end/ });
    await lowEnd.click();
    await expect(lowEnd).toHaveAttribute("aria-pressed", "true");
    const { box } = await placeFifty(page);
    const { idle, drag, pan } = await dragAllAndPan(page, box);
    check("drag 50 parts (Low-end)", idle, drag);
    check("pan 50 parts (Low-end)", idle, pan);
  });
});

/**
 * Day 13: 50 parts with 45 wires (a 10 × 5 grid, each row chained by short wires), opened from a
 * share link. Half of the parts are dragged: the 5 wires between the halves rubber-band live.
 */
async function openWiredFifty(page: Page) {
  await page.goto("/studio");
  await expect(canvas(page)).toBeVisible();
  const url = await page.evaluate(async () => {
    const parts = [];
    const wires = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 10; col++) {
        const x = (col - 4.5) * 500;
        const y = (row - 2) * 400;
        parts.push({
          id: `r${row}-${col}`,
          type: "resistor",
          name: `R${row * 10 + col + 1}`,
          x,
          y,
          rotation: 0,
          flip: false,
          props: { resistance: 1000 },
        });
        if (col < 9)
          wires.push({
            id: `w${row}-${col}`,
            points: [
              [x + 200, y],
              [x + 300, y],
            ],
          });
      }
    }
    const project = {
      format: "robosim-project",
      version: 3,
      id: "e2e-wired-fifty",
      name: "Wired fifty",
      lab: "circuit",
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
      parts,
      wires,
      labels: [],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(project));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = "";
    for (const b of compressed) binary += String.fromCharCode(b);
    const token = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `/studio#share=${token}`;
  });
  await page.goto("/");
  await page.goto(url);
  await expect(header(page)).toContainText("50 parts");
  await expect(canvas(page).locator("[data-wire]")).toHaveCount(45);
  await page.getByRole("button", { name: "Zoom to 100 %" }).click();
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error("no layout");
  return box;
}

test.describe("schematic performance (50 parts + 45 wires)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("drags half of a wired drawing smoothly while its wires stretch", async ({ page }) => {
    const box = await openWiredFifty(page);
    await page.waitForTimeout(500);
    const idle = await measure(page, 2000);

    // Box-select the left five columns (left → right: parts and wires fully inside).
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 4.5 * 48 - 40, cy - 2 * 38.4 - 40);
    await page.mouse.down();
    await page.mouse.move(cx - 2, cy + 2 * 38.4 + 40, { steps: 5 });
    await page.mouse.up();
    await expect(header(page)).toContainText("45 selected"); // 25 parts + 20 wires

    const grab = { x: cx - 4.5 * 48, y: cy - 2 * 38.4 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    const dragging = measure(page, 2000);
    await sweep(page, grab, 2000);
    const drag = await dragging;
    await page.mouse.up();
    check("drag 25 parts with 5 stretching wires", idle, drag);

    // Every wire is still there and every pin between the halves still connected.
    await expect(canvas(page).locator("[data-wire]")).toHaveCount(45);
    await expect(canvas(page).locator('[data-part] circle[r="12"]')).toHaveCount(10);
  });
});
