/**
 * Open-project tabs in the studio top bar. Pure state + actions so the rules (which tab becomes
 * active after a close, how new tabs are named) are unit-tested. Project contents arrive on Day 07.
 */

export const MAX_PROJECT_TABS = 12;
export const UNTITLED = "Untitled";

export type ProjectTab = { id: string; name: string };
export type ProjectTabsState = { tabs: ProjectTab[]; activeId: string | null };

export const emptyProjectTabs: ProjectTabsState = { tabs: [], activeId: null };

/** "Untitled", then "Untitled 2", "Untitled 3"… — the lowest number not already open. */
export function nextUntitledName(tabs: readonly ProjectTab[]): string {
  const names = new Set(tabs.map((t) => t.name));
  if (!names.has(UNTITLED)) return UNTITLED;
  for (let n = 2; ; n++) {
    const name = `${UNTITLED} ${n}`;
    if (!names.has(name)) return name;
  }
}

/** Opens a new tab and makes it active. Does nothing when the tab limit is reached. */
export function openProjectTab(
  state: ProjectTabsState,
  id: string,
  name: string = nextUntitledName(state.tabs),
): ProjectTabsState {
  if (state.tabs.length >= MAX_PROJECT_TABS || state.tabs.some((t) => t.id === id)) return state;
  return { tabs: [...state.tabs, { id, name }], activeId: id };
}

/** Makes a tab active. Unknown ids are ignored. */
export function activateProjectTab(state: ProjectTabsState, id: string): ProjectTabsState {
  if (state.activeId === id || !state.tabs.some((t) => t.id === id)) return state;
  return { ...state, activeId: id };
}

/**
 * Closes a tab. When the active tab closes, the tab to its right becomes active
 * (or the one to its left when it was the last), like a browser.
 */
export function closeProjectTab(state: ProjectTabsState, id: string): ProjectTabsState {
  const index = state.tabs.findIndex((t) => t.id === id);
  if (index === -1) return state;
  const tabs = state.tabs.filter((t) => t.id !== id);
  if (state.activeId !== id) return { tabs, activeId: state.activeId };
  const next = tabs[index] ?? tabs[index - 1] ?? null;
  return { tabs, activeId: next?.id ?? null };
}

/** Moves to the next (+1) or previous (−1) tab, wrapping around. */
export function cycleProjectTab(state: ProjectTabsState, step: 1 | -1): ProjectTabsState {
  const count = state.tabs.length;
  if (count < 2) return state;
  const index = state.tabs.findIndex((t) => t.id === state.activeId);
  const next = state.tabs[(((index + step) % count) + count) % count];
  return next ? { ...state, activeId: next.id } : state;
}
