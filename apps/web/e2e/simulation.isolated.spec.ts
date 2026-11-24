import { expect, test, type Page } from "@playwright/test";

const simStatus = (page: Page) => page.getByTestId("sim-status");
const simGroup = (page: Page) => page.getByRole("group", { name: "Simulation" });
const simTime = async (page: Page) =>
  Number((await page.getByTestId("sim-time").innerText()).replace(/[^\d.]/g, ""));

/** Frames and long tasks on the main thread during 2 s. */
function measureMainThread(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ frames: number; worstGap: number; longTasks: number[] }>((resolve) => {
        const longTasks: number[] = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(Math.round(entry.duration));
        });
        observer.observe({ type: "longtask", buffered: false });
        let frames = 0;
        let worstGap = 0;
        let last = performance.now();
        const end = last + 2000;
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
  );
}

// Timing tests: run alone, one at a time (see the "isolated" project in playwright.config.ts).
test.describe.configure({ mode: "serial" });

test.describe("simulation kernel", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(
      page.locator(".dv-groupview").getByRole("textbox", { name: "Name" }),
    ).toBeVisible();
    await expect(simStatus(page)).toHaveText("Idle");
  });

  test("the worker runs the 1 kHz demo model without making the page janky", async ({ page }) => {
    // Baseline: the same page with nothing running (machines and CI runners differ a lot).
    await page.waitForTimeout(1000);
    const idle = await measureMainThread(page);

    await simGroup(page).getByRole("button", { name: "Run" }).click();
    await expect(simStatus(page)).toContainText("Running");
    await expect(page.getByRole("definition").first()).toBeVisible(); // live signal readout
    await page.waitForTimeout(1500); // warm up: worker loaded, steps/s meter filled
    const result = await measureMainThread(page);
    const stepsPerSecond = Number(
      (await simStatus(page).innerText()).match(/(\d+) steps\/s/)?.[1] ?? 0,
    );
    test.info().annotations.push({
      type: "jank check",
      description: `${stepsPerSecond} steps/s; frames in 2 s: ${idle.frames} idle → ${result.frames} running; worst frame gap ${result.worstGap} ms; long tasks ${JSON.stringify(result.longTasks)}`,
    });

    expect(stepsPerSecond).toBeGreaterThanOrEqual(900); // ~1 kHz in real time
    // The page keeps (almost) its idle frame rate while the worker simulates.
    expect(result.frames).toBeGreaterThanOrEqual(idle.frames * 0.75);
    expect(result.worstGap).toBeLessThan(150);
    expect(result.longTasks.filter((ms) => ms >= 100)).toEqual([]);
  });

  test("pause, single step and stop", async ({ page }) => {
    const group = simGroup(page);
    await expect(group.getByRole("button", { name: "Stop" })).toBeDisabled();
    await group.getByRole("button", { name: "Run" }).click();
    await expect(simStatus(page)).toContainText("Running");
    await expect(group.getByRole("button", { name: "Step" })).toBeDisabled();

    await group.getByRole("button", { name: "Pause" }).click();
    await expect(simStatus(page)).toContainText("Paused");
    const paused = await simTime(page);
    await page.waitForTimeout(300);
    expect(await simTime(page)).toBe(paused); // time stands still

    await group.getByRole("button", { name: "Step" }).click();
    await expect.poll(() => simTime(page)).toBeCloseTo(paused + 0.001, 6);

    await group.getByRole("button", { name: "Stop" }).click();
    await expect(simStatus(page)).toHaveText("Idle");
    await expect(page.getByRole("definition").nth(1)).toHaveText("0.0000 m");
  });

  test("keyboard: Ctrl+Enter runs and pauses, Alt+. steps", async ({ page }) => {
    await page.getByTestId("studio-canvas").click();
    await page.keyboard.press("Alt+Period");
    await expect(simStatus(page)).toContainText("Paused");
    await expect(page.getByTestId("sim-time")).toHaveText("t 0.001 s");
    await page.keyboard.press("Control+Enter");
    await expect(simStatus(page)).toContainText("Running");
    await page.keyboard.press("Control+Enter");
    await expect(simStatus(page)).toContainText("Paused");
  });

  test("the speed changes how fast simulated time runs", async ({ page }) => {
    await simGroup(page).getByRole("combobox", { name: "Simulation speed" }).click();
    await page.getByRole("option", { name: "0.25×" }).click();
    await simGroup(page).getByRole("button", { name: "Run" }).click();
    await page.waitForTimeout(2000);
    await simGroup(page).getByRole("button", { name: "Pause" }).click();
    const t = await simTime(page);
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(0.8); // ≈ 0.5 s of simulated time for 2 s of real time
  });
});
