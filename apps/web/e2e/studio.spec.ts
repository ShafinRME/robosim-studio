import { expect, test, type Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.locator(".dv-tab", { hasText: name });
const groupOf = (page: Page, name: string) =>
  page.locator(".dv-groupview").filter({ has: tab(page, name) });

test.describe("studio workspace", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(tab(page, "Canvas")).toBeVisible();
  });

  test("loads without errors and shows the default layout", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();

    await expect(page).toHaveTitle("Studio · RoboSim Studio");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("RoboSim Studio workspace");
    for (const name of ["Explorer", "Canvas", "Inspector", "Console"]) {
      await expect(tab(page, name)).toBeVisible();
    }
    // Four panels, each in its own group.
    await expect(page.locator(".dv-groupview")).toHaveCount(4);
    await expect(page.getByTestId("studio-canvas")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a group can be floated and docked back", async ({ page }) => {
    await groupOf(page, "Inspector").getByRole("button", { name: "Float this group" }).click();
    await expect(
      page.locator(".dv-resize-container").filter({ has: tab(page, "Inspector") }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Dock back into the layout" }).click();
    await expect(page.getByRole("button", { name: "Dock back into the layout" })).toHaveCount(0);
    await expect(page.locator(".dv-groupview")).toHaveCount(4);
  });

  test("a group can be maximized and restored", async ({ page }) => {
    const canvasWidth = async () => (await groupOf(page, "Canvas").boundingBox())?.width ?? 0;
    const before = await canvasWidth();

    await groupOf(page, "Canvas").getByRole("button", { name: "Maximize this group" }).click();
    await expect(page.getByRole("button", { name: "Restore layout" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(canvasWidth).toBeGreaterThan(1300);

    await page.getByRole("button", { name: "Restore layout" }).click();
    await expect.poll(canvasWidth).toBeLessThan(before + 2);
  });

  test("dragging a tab onto another group's tab strip joins them as tabs", async ({ page }) => {
    await tab(page, "Console").dragTo(tab(page, "Canvas"));

    await expect(page.locator(".dv-groupview")).toHaveCount(3);
    await expect(groupOf(page, "Canvas")).toContainText("Console");
  });

  test("the layout is saved and restored after a reload", async ({ page }) => {
    await tab(page, "Console").dragTo(tab(page, "Canvas"));
    await groupOf(page, "Inspector").getByRole("button", { name: "Float this group" }).click();
    await expect(page.getByRole("button", { name: "Dock back into the layout" })).toBeVisible();

    await page.reload();
    await expect(tab(page, "Canvas")).toBeVisible();
    await expect(groupOf(page, "Canvas")).toContainText("Console");
    await expect(page.getByRole("button", { name: "Dock back into the layout" })).toBeVisible();
    await expect(page.locator(".dv-groupview")).toHaveCount(3);
  });

  test("Reset layout restores the default panels", async ({ page }) => {
    await groupOf(page, "Explorer").getByRole("button", { name: "Float this group" }).click();
    await tab(page, "Console").dragTo(tab(page, "Canvas"));

    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Reset layout" }).click();
    await expect(page.locator(".dv-groupview")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Dock back into the layout" })).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".dv-groupview")).toHaveCount(4);
  });

  const badLayouts: [name: string, value: string][] = [
    ["corrupt JSON", "{broken"],
    [
      "an unknown panel type",
      JSON.stringify({
        version: 1,
        layout: { panels: { x: { id: "x", contentComponent: "iframe" } } },
      }),
    ],
    ["a future version", JSON.stringify({ version: 99, layout: {} })],
  ];
  for (const [name, value] of badLayouts) {
    test(`a saved layout with ${name} is ignored`, async ({ page }) => {
      await page.evaluate((v) => localStorage.setItem("robosim-layout", v), value);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.reload();
      await expect(page.locator(".dv-groupview")).toHaveCount(4);
      for (const panel of ["Explorer", "Canvas", "Inspector", "Console"]) {
        await expect(tab(page, panel)).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }

  test("dragging a tab onto a group's edge splits it", async ({ page }) => {
    // Drop the Inspector on the top edge of the canvas: it leaves the right column and splits the
    // canvas column, ending up above the canvas.
    const content = groupOf(page, "Canvas").locator(".dv-content-container");
    const box = await content.boundingBox();
    if (!box) throw new Error("canvas group not visible");
    await tab(page, "Inspector").dragTo(content, {
      targetPosition: { x: box.width / 2, y: 12 },
    });

    await expect(page.locator(".dv-groupview")).toHaveCount(4);
    const top = async (name: string) => (await groupOf(page, name).boundingBox())?.y ?? 0;
    await expect
      .poll(async () => (await top("Canvas")) - (await top("Inspector")))
      .toBeGreaterThan(50);
  });
});
