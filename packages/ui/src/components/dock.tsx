"use client";

import {
  DockviewReact,
  type DockviewTheme,
  type IDockviewHeaderActionsProps,
  type IDockviewReactProps,
} from "dockview-react";
import { Maximize2, Minimize2, PanelTopClose, PictureInPicture2 } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@robosim/ui/components/button";
import { cn } from "@robosim/ui/lib/utils";
import "dockview-react/dist/styles/dockview.css";
import "@robosim/ui/styles/dock.css";

export type {
  DockviewApi,
  DockviewReadyEvent,
  IDockviewPanelProps,
  SerializedDockview,
} from "dockview-react";

/** Signal theme for Dockview (ADR 003): 4 px gaps between groups, styles in `styles/dock.css`. */
export const signalDockTheme: DockviewTheme = {
  name: "signal",
  className: "dockview-theme-signal",
  gap: 4,
};

/** Size of a group when it is popped out into a floating window. */
const FLOAT_SIZE = { width: 420, height: 280 };
/** Width of a floating group docked back as a column on the right. */
const DOCKED_WIDTH = 280;

function useGroupState({ api, containerApi }: IDockviewHeaderActionsProps) {
  const [floating, setFloating] = useState(api.location.type === "floating");
  const [maximized, setMaximized] = useState(api.isMaximized());

  useEffect(() => {
    const location = api.onDidLocationChange((event) => {
      setFloating(event.location.type === "floating");
    });
    const maximize = containerApi.onDidMaximizedGroupChange(() => {
      setMaximized(api.isMaximized());
    });
    return () => {
      location.dispose();
      maximize.dispose();
    };
  }, [api, containerApi]);

  return { floating, maximized };
}

/** Group header actions: float / dock back, and maximize / restore. */
function DockGroupActions(props: IDockviewHeaderActionsProps) {
  const { api, containerApi, group } = props;
  const { floating, maximized } = useGroupState(props);

  return (
    <div className="flex h-full items-center gap-0.5 px-1">
      {floating ? (
        <IconButton
          label="Dock back into the layout"
          size="icon-sm"
          onClick={() => {
            api.moveTo({ position: "right" });
            api.setSize({ width: DOCKED_WIDTH });
          }}
        >
          <PanelTopClose />
        </IconButton>
      ) : (
        <>
          <IconButton
            label="Float this group"
            size="icon-sm"
            onClick={() => {
              containerApi.addFloatingGroup(group, {
                ...FLOAT_SIZE,
                x: Math.max(16, (containerApi.width - FLOAT_SIZE.width) / 2),
                y: Math.max(16, (containerApi.height - FLOAT_SIZE.height) / 3),
              });
            }}
          >
            <PictureInPicture2 />
          </IconButton>
          <IconButton
            label={maximized ? "Restore layout" : "Maximize this group"}
            size="icon-sm"
            aria-pressed={maximized}
            onClick={() => (maximized ? api.exitMaximized() : api.maximize())}
          >
            {maximized ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
        </>
      )}
    </div>
  );
}

export type DockProps = Omit<IDockviewReactProps, "theme"> & { className?: string };

/**
 * Docking workspace (Dockview in Signal style). Panels can be dragged, docked, split, tabbed,
 * floated and maximized. Popout windows are deliberately not offered (ADR 003).
 */
export function Dock({ className, ...props }: DockProps) {
  return (
    <div data-slot="dock" className={cn("h-full w-full p-1", className)}>
      <DockviewReact
        theme={signalDockTheme}
        rightHeaderActionsComponent={DockGroupActions}
        getTabContextMenuItems={() => [
          "close",
          "closeOthers",
          "closeAll",
          "separator",
          "float",
          "maximize",
        ]}
        {...props}
      />
    </div>
  );
}
