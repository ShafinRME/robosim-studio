import { expect, test, type Page } from "@playwright/test";

const menu = (page: Page, name: string) =>
  page.getByRole("menubar", { name: "Studio menu" }).getByRole("menuitem", { name });
const projectTabs = (page: Page) =>
  page.getByRole("tablist", { name: "Open projects" }).getByRole("tab");

test.describe("studio top bar and project tabs", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await expect(page.locator(".dv-tab", { hasText: "Canvas" })).toBeVisible();
  });

  test("shows menus, simulation controls and the theme switch", async ({ page }) => {
    for (const name of ["File", "Edit", "View", "Help"]) {
      await expect(menu(page, name)).toBeVisible();
    }
    const simulation = page.getByRole("group", { name: "Simulation" });
    // Before anything ran: Run and Step work, Stop has nothing to stop. (Details: simulation tests.)
    await expect(simulation.getByRole("button", { name: "Run" })).toBeEnabled();
    await expect(simulation.getByRole("button", { name: "Step" })).toBeEnabled();
    await expect(simulation.getByRole("button", { name: "Stop" })).toBeDisabled();
    await expect(simulation.getByRole("combobox", { name: "Simulation speed" })).toHaveText("1×");
    await expect(page.getByRole("radiogroup", { name: /theme/i })).toBeVisible();
  });

  test("View menu hides and shows panels", async ({ page }) => {
    await menu(page, "View").click();
    const consoleItem = page.getByRole("menuitemcheckbox", { name: "Console" });
    await expect(consoleItem).toHaveAttribute("aria-checked", "true");
    await consoleItem.click();
    await expect(page.locator(".dv-tab", { hasText: "Console" })).toHaveCount(0);

    await menu(page, "View").click();
    await expect(consoleItem).toHaveAttribute("aria-checked", "false");
    await consoleItem.click();
    await expect(page.locator(".dv-tab", { hasText: "Console" })).toBeVisible();
    await expect(page.locator(".dv-groupview")).toHaveCount(4);
  });

  test("a closed panel can be reopened from the View menu", async ({ page }) => {
    await page.locator(".dv-tab", { hasText: "Explorer" }).getByRole("button").click();
    await expect(page.locator(".dv-tab", { hasText: "Explorer" })).toHaveCount(0);

    await menu(page, "View").click();
    await page.getByRole("menuitemcheckbox", { name: "Explorer" }).click();
    await expect(page.locator(".dv-tab", { hasText: "Explorer" })).toBeVisible();
  });

  test("Help menu links open the project on GitHub in a new tab", async ({ page }) => {
    await menu(page, "Help").click();
    const source = page.getByRole("menuitem", { name: "Source code on GitHub" });
    await expect(source).toHaveAttribute("href", "https://github.com/ShafinRME/robosim-studio");
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("project tabs open, switch and close", async ({ page }) => {
    await expect(projectTabs(page)).toHaveText(["Untitled"]);

    await page.getByRole("button", { name: "New project" }).click();
    await menu(page, "File").click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(projectTabs(page)).toHaveText(["Untitled", "Untitled 2", "Untitled 3"]);
    await expect(projectTabs(page).nth(2)).toHaveAttribute("aria-selected", "true");

    await projectTabs(page).first().click();
    await expect(projectTabs(page).first()).toHaveAttribute("aria-selected", "true");

    // Closing the active tab activates the tab to its right.
    await page.getByRole("button", { name: "Close Untitled", exact: true }).click();
    await expect(projectTabs(page)).toHaveText(["Untitled 2", "Untitled 3"]);
    await expect(projectTabs(page).first()).toHaveAttribute("aria-selected", "true");
  });

  test("arrow keys move between project tabs", async ({ page }) => {
    await page.getByRole("button", { name: "New project" }).click();
    await projectTabs(page).nth(1).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(projectTabs(page).first()).toBeFocused();
    await expect(projectTabs(page).first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(projectTabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  });

  test("closing the last project shows an empty state with New project", async ({ page }) => {
    await menu(page, "File").click();
    await page.getByRole("menuitem", { name: "Close project" }).click();
    await expect(projectTabs(page)).toHaveCount(0);
    await expect(page.getByText("No project open", { exact: true })).toBeVisible();

    await menu(page, "File").click();
    await expect(page.getByRole("menuitem", { name: "Close project" })).toBeDisabled();
    await page.keyboard.press("Escape");

    await page.getByTestId("studio-workspace").getByRole("button", { name: "New project" }).click();
    await expect(projectTabs(page)).toHaveText(["Untitled"]);
  });
});
