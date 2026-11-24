"use client";

import { formatSI } from "@robosim/core";
import { Badge } from "@robosim/ui/components/badge";
import { IconButton } from "@robosim/ui/components/button";
import { Input } from "@robosim/ui/components/input";
import {
  Inspector,
  InspectorRow,
  InspectorSection,
  InspectorValue,
} from "@robosim/ui/components/inspector";
import { NumberField } from "@robosim/ui/components/number-field";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@robosim/ui/components/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@robosim/ui/components/select";
import { Slider } from "@robosim/ui/components/slider";
import { Switch } from "@robosim/ui/components/switch";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarSpacer,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from "@robosim/ui/components/toolbar";
import {
  CapacitorIcon,
  GroundIcon,
  LedIcon,
  MicrocontrollerIcon,
  ResistorIcon,
  ServoIcon,
} from "@robosim/ui/icons/robotics";
import { cn } from "@robosim/ui/lib/utils";
import {
  Hand,
  Layers,
  MousePointer2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Spline,
  StepForward,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useState } from "react";

const SUPPLY = 5; // V
const LED_FORWARD = 2; // V (red LED)

const PARTS = [
  { id: "R1", name: "Resistor", icon: ResistorIcon },
  { id: "D1", name: "LED (red)", icon: LedIcon },
  { id: "C1", name: "Capacitor", icon: CapacitorIcon },
  { id: "U1", name: "Arduino Uno", icon: MicrocontrollerIcon },
  { id: "M1", name: "Servo SG90", icon: ServoIcon },
  { id: "GND", name: "Ground", icon: GroundIcon },
] as const;

export function WorkspaceDemo() {
  const [tool, setTool] = useState("select");
  const [running, setRunning] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [selected, setSelected] = useState<string>("R1");
  const [name, setName] = useState("R1");
  const [resistance, setResistance] = useState(220);
  const [rating, setRating] = useState("0.25");
  const [x, setX] = useState(180);
  const [y, setY] = useState(50);
  const [rotation, setRotation] = useState([0]);
  const [showLabel, setShowLabel] = useState(true);

  const current = running ? Math.max(0, (SUPPLY - LED_FORWARD) / resistance) : 0;
  const power = current * current * resistance;
  const overheating = power > Number(rating);
  const brightness = Math.min(1, current / 0.02);

  return (
    <div className="grid h-[30rem] gap-2 md:grid-cols-[13rem_1fr_17rem]">
      {/* Parts */}
      <Panel aria-label="Parts">
        <PanelHeader
          title="Parts"
          icon={<Layers />}
          meta={`${PARTS.length}`}
          actions={
            <IconButton label="Add part" size="icon-sm">
              <Plus />
            </IconButton>
          }
        />
        <PanelBody className="p-1">
          <ul className="flex flex-col gap-px">
            {PARTS.map((part) => {
              const Icon = part.icon;
              const active = selected === part.id;
              return (
                <li key={part.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(part.id)}
                    aria-current={active || undefined}
                    className={cn(
                      "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2",
                      active
                        ? "bg-brand-soft text-foreground"
                        : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                    )}
                  >
                    <Icon size={14} className={active ? "text-brand" : undefined} />
                    <span className="w-8 font-mono text-2xs text-faint-foreground">{part.id}</span>
                    {part.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </PanelBody>
        <PanelFooter>Click a part to inspect it</PanelFooter>
      </Panel>

      {/* Canvas */}
      <Panel aria-label="Circuit canvas">
        <Toolbar aria-label="Canvas tools">
          <ToolbarToggleGroup
            type="single"
            value={tool}
            onValueChange={(v) => v && setTool(v)}
            aria-label="Tool"
          >
            <ToolbarToggleItem value="select" label="Select" shortcut="V">
              <MousePointer2 />
            </ToolbarToggleItem>
            <ToolbarToggleItem value="wire" label="Wire" shortcut="W">
              <Spline />
            </ToolbarToggleItem>
            <ToolbarToggleItem value="pan" label="Pan" shortcut="H">
              <Hand />
            </ToolbarToggleItem>
          </ToolbarToggleGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <ToolbarButton
              label={running ? "Pause" : "Run"}
              shortcut="Space"
              aria-pressed={running}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? <Pause /> : <Play />}
            </ToolbarButton>
            <ToolbarButton label="Step" shortcut=".">
              <StepForward />
            </ToolbarButton>
            <ToolbarButton label="Reset" onClick={() => setResistance(220)}>
              <RotateCcw />
            </ToolbarButton>
          </ToolbarGroup>
          <ToolbarSpacer />
          <Badge tone={running ? "success" : "neutral"} led={running ? "pulse" : true}>
            {running ? "Live" : "Paused"}
          </Badge>
          <ToolbarSeparator />
          <ToolbarButton label="Zoom out" onClick={() => setZoom((z) => Math.max(25, z - 25))}>
            <ZoomOut />
          </ToolbarButton>
          <span className="tabular w-11 text-center font-mono text-2xs text-muted-foreground">
            {zoom}%
          </span>
          <ToolbarButton label="Zoom in" onClick={() => setZoom((z) => Math.min(400, z + 25))}>
            <ZoomIn />
          </ToolbarButton>
        </Toolbar>
        <PanelBody className="relative bg-blueprint">
          <svg
            viewBox="0 0 360 230"
            role="img"
            aria-label={`Circuit: ${SUPPLY} V battery, ${name} ${formatSI(resistance, "Ω")}, red LED`}
            className="absolute inset-0 m-auto h-full max-h-80 w-full"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            <g
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M60 95V50h90M210 50h90v55M300 145v45H60v-55" />
            </g>
            {running ? (
              <path
                d="M60 95V50h90M210 50h90v55M300 145v45H60v-55"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="2 10"
                className="animate-flow"
                opacity={0.4 + 0.6 * brightness}
              />
            ) : null}
            {/* battery */}
            <g stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round">
              <path d="M44 95h32M50 103h20M44 111h32M50 119h20M60 119v16" />
            </g>
            <text x="22" y="110" className="fill-muted-foreground font-mono text-[9px]">
              {SUPPLY}V
            </text>
            {/* resistor (selectable) */}
            <g
              onClick={() => setSelected("R1")}
              className="cursor-pointer"
              stroke={selected === "R1" ? "var(--brand)" : "var(--foreground)"}
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              transform={`rotate(${rotation[0] ?? 0} 180 50)`}
            >
              {selected === "R1" ? (
                <rect
                  x="144"
                  y="34"
                  width="72"
                  height="32"
                  rx="4"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  opacity="0.7"
                />
              ) : null}
              <path d="M150 50l6-10 12 20 12-20 12 20 12-20 6 10" />
            </g>
            {showLabel ? (
              <text
                x="180"
                y="84"
                textAnchor="middle"
                className={cn("font-mono text-[10px]", overheating ? "fill-danger" : "fill-brand")}
              >
                {name} · {formatSI(resistance, "Ω")}
              </text>
            ) : null}
            {/* LED */}
            <circle cx="300" cy="125" r="22" fill="#ff4d4d" opacity={0.35 * brightness} />
            <g
              stroke="var(--foreground)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              <path d="M288 105h24l-12 20z" fill={`rgba(255,77,77,${0.15 + 0.85 * brightness})`} />
              <path d="M288 125h24M300 125v20" />
              <path d="M316 108l8-6M322 102h3v3M318 116l8-6M324 110h3v3" strokeWidth="1.5" />
            </g>
            <text x="322" y="135" className="fill-muted-foreground font-mono text-[9px]">
              D1
            </text>
          </svg>
        </PanelBody>
        <PanelFooter>
          <span>tool: {tool}</span>
          <span>grid 10 px</span>
          <span className={overheating ? "text-danger" : undefined}>
            {overheating ? "1 warning" : "0 warnings"}
          </span>
        </PanelFooter>
      </Panel>

      {/* Inspector */}
      <Panel aria-label="Inspector">
        <PanelHeader title="Inspector" icon={<SlidersHorizontal />} meta={`${name} · Resistor`} />
        <PanelBody>
          <Inspector defaultOpen={["component", "simulation", "transform"]}>
            <InspectorSection id="component" title="Component">
              <InspectorRow label="Name">
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    maxLength={12}
                    onChange={(e) => setName(e.target.value.replace(/[^\w-]/g, "") || "R1")}
                    className="h-7 font-mono text-xs"
                  />
                )}
              </InspectorRow>
              <InspectorRow label="Resistance" hint="Type 220, 4.7k or 1M">
                {(id) => (
                  <NumberField
                    id={id}
                    value={resistance}
                    onChange={setResistance}
                    unit="Ω"
                    min={1}
                    step={10}
                  />
                )}
              </InspectorRow>
              <InspectorRow label="Power rating">
                {(id) => (
                  <Select value={rating} onValueChange={setRating}>
                    <SelectTrigger id={id} size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.125">⅛ W</SelectItem>
                      <SelectItem value="0.25">¼ W</SelectItem>
                      <SelectItem value="0.5">½ W</SelectItem>
                      <SelectItem value="1">1 W</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </InspectorRow>
            </InspectorSection>

            <InspectorSection
              id="simulation"
              title="Live simulation"
              meta={running ? "1 kHz" : "paused"}
            >
              <InspectorRow label="Current">
                <InspectorValue>{formatSI(current, "A")}</InspectorValue>
              </InspectorRow>
              <InspectorRow label="Voltage drop">
                <InspectorValue>{formatSI(current * resistance, "V")}</InspectorValue>
              </InspectorRow>
              <InspectorRow label="Power">
                <InspectorValue tone={overheating ? "danger" : "brand"}>
                  {formatSI(power, "W")}
                  {overheating ? " · too hot" : ""}
                </InspectorValue>
              </InspectorRow>
            </InspectorSection>

            <InspectorSection id="transform" title="Transform">
              <InspectorRow label="Position X">
                {(id) => (
                  <NumberField
                    id={id}
                    value={x}
                    onChange={setX}
                    unit="px"
                    engineering={false}
                    step={10}
                  />
                )}
              </InspectorRow>
              <InspectorRow label="Position Y">
                {(id) => (
                  <NumberField
                    id={id}
                    value={y}
                    onChange={setY}
                    unit="px"
                    engineering={false}
                    step={10}
                  />
                )}
              </InspectorRow>
              <InspectorRow label="Rotation">
                <div className="flex items-center gap-2">
                  <Slider
                    value={rotation}
                    onValueChange={setRotation}
                    min={0}
                    max={270}
                    step={90}
                    aria-label="Rotation"
                  />
                  <span className="tabular w-8 text-right font-mono text-2xs text-brand">
                    {rotation[0]}°
                  </span>
                </div>
              </InspectorRow>
            </InspectorSection>

            <InspectorSection id="display" title="Display">
              <InspectorRow label="Show label">
                {(id) => <Switch id={id} checked={showLabel} onCheckedChange={setShowLabel} />}
              </InspectorRow>
            </InspectorSection>
          </Inspector>
        </PanelBody>
      </Panel>
    </div>
  );
}
