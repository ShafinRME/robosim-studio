"use client";

import { formatSI } from "@robosim/core";
import { Badge } from "@robosim/ui/components/badge";
import { Button, IconButton } from "@robosim/ui/components/button";
import { Input } from "@robosim/ui/components/input";
import { Kbd, KbdGroup } from "@robosim/ui/components/kbd";
import { NumberField } from "@robosim/ui/components/number-field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@robosim/ui/components/select";
import { Separator } from "@robosim/ui/components/separator";
import { Slider } from "@robosim/ui/components/slider";
import { Switch } from "@robosim/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@robosim/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@robosim/ui/components/tooltip";
import { Pause, Play, RotateCcw, Save, StepForward, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b py-4 first:pt-0 last:border-0 last:pb-0 md:grid-cols-[10rem_1fr]">
      <div className="font-mono text-2xs tracking-wider text-faint-foreground uppercase">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ControlsDemo() {
  const [resistance, setResistance] = useState(4700);
  const [voltage, setVoltage] = useState(5);
  const [running, setRunning] = useState(false);
  const [grid, setGrid] = useState(true);
  const [speed, setSpeed] = useState([1]);

  const current = voltage / resistance;

  return (
    <div className="flex flex-col">
      <Row label="Buttons">
        <Button>Run simulation</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">
          <Trash2 /> Delete
        </Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </Row>
      <Row label="Sizes">
        <Button size="sm">Small 24</Button>
        <Button size="md">Default 28</Button>
        <Button size="lg">Large 36</Button>
      </Row>
      <Row label="Icon buttons">
        <div className="flex items-center gap-0.5 rounded-md border bg-surface-1 p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                label={running ? "Pause" : "Run"}
                variant={running ? "primary" : "ghost"}
                onClick={() => setRunning((r) => !r)}
              >
                {running ? <Pause /> : <Play />}
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>
              {running ? "Pause" : "Run"}
              <Kbd>Space</Kbd>
            </TooltipContent>
          </Tooltip>
          <IconButton label="Step one tick">
            <StepForward />
          </IconButton>
          <IconButton label="Reset">
            <RotateCcw />
          </IconButton>
          <Separator orientation="vertical" className="mx-0.5 h-4" />
          <IconButton label="Save">
            <Save />
          </IconButton>
        </div>
        <Badge tone={running ? "success" : "neutral"} led={running ? "pulse" : true}>
          {running ? "Running" : "Stopped"}
        </Badge>
        <span className="text-xs text-muted-foreground">Hover the play button for a tooltip.</span>
      </Row>
      <Row label="Badges">
        <Badge>Neutral</Badge>
        <Badge tone="brand">Brand</Badge>
        <Badge tone="highlight">Copper</Badge>
        <Badge tone="success" led>
          Ok
        </Badge>
        <Badge tone="warning" led>
          Warning
        </Badge>
        <Badge tone="danger" led>
          Short circuit
        </Badge>
        <Badge tone="info">ESP32</Badge>
      </Row>
      <Row label="Keyboard">
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span className="text-xs text-muted-foreground">Command palette</span>
        <KbdGroup>
          <Kbd>Shift</Kbd>
          <Kbd>↑</Kbd>
        </KbdGroup>
        <span className="text-xs text-muted-foreground">Step ×10 in number fields</span>
      </Row>
      <Row label="Text & select">
        <Input placeholder="Project name" className="w-56" aria-label="Project name" />
        <Input placeholder="Invalid" aria-invalid className="w-40" aria-label="Invalid example" />
        <Select defaultValue="uno">
          <SelectTrigger className="w-48" aria-label="Board">
            <SelectValue placeholder="Choose a board" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Arduino</SelectLabel>
              <SelectItem value="uno">Arduino Uno</SelectItem>
              <SelectItem value="nano">Arduino Nano</SelectItem>
              <SelectItem value="mega">Arduino Mega 2560</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Espressif · Raspberry Pi</SelectLabel>
              <SelectItem value="esp32">ESP32 DevKitC</SelectItem>
              <SelectItem value="pico">Raspberry Pi Pico</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Engineering numbers">
        <NumberField
          label="Resistance"
          value={resistance}
          onChange={setResistance}
          unit="Ω"
          min={0}
          step={100}
          className="w-40"
        />
        <NumberField
          label="Supply"
          value={voltage}
          onChange={setVoltage}
          unit="V"
          min={0}
          max={30}
          step={0.1}
          className="w-32"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Current (Ohm&apos;s law)</span>
          <output
            aria-live="polite"
            className="tabular flex h-(--control-h) items-center rounded-md border border-brand/30 bg-brand-soft px-2.5 font-mono text-[0.8125rem] text-brand"
          >
            I = {formatSI(current, "A")}
          </output>
        </div>
        <span className="max-w-56 text-xs text-muted-foreground">
          Type <code className="font-mono">4.7k</code>, <code className="font-mono">100</code> or{" "}
          <code className="font-mono">1M</code>; use ↑/↓ to step.
        </span>
      </Row>
      <Row label="Switch & slider">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={grid} onCheckedChange={setGrid} /> Snap to grid
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch disabled /> Disabled
        </label>
        <div className="flex w-72 items-center gap-3">
          <span className="font-mono text-2xs text-faint-foreground uppercase">Speed</span>
          <Slider
            value={speed}
            onValueChange={setSpeed}
            min={0.1}
            max={4}
            step={0.1}
            aria-label="Simulation speed"
          />
          <span className="tabular w-10 text-right font-mono text-xs text-brand">
            {(speed[0] ?? 1).toFixed(1)}×
          </span>
        </div>
      </Row>
      <Row label="Tabs">
        <Tabs defaultValue="scope" className="w-full max-w-xl">
          <TabsList>
            <TabsTrigger value="scope">Oscilloscope</TabsTrigger>
            <TabsTrigger value="serial">Serial monitor</TabsTrigger>
            <TabsTrigger value="logic">Logic analyzer</TabsTrigger>
          </TabsList>
          <TabsContent value="scope" className="text-sm text-muted-foreground">
            4 channels · 1 ms/div · trigger CH1 rising.
          </TabsContent>
          <TabsContent value="serial" className="font-mono text-xs text-muted-foreground">
            &gt; Hello from Arduino Uno
          </TabsContent>
          <TabsContent value="logic" className="text-sm text-muted-foreground">
            8 digital pins sampled at 1 MHz.
          </TabsContent>
        </Tabs>
      </Row>
    </div>
  );
}
