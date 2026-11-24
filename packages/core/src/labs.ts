/** The 10 labs of RoboSim Studio, in build order (see docs/adr/001-lab-taxonomy.md). */
export const LABS = [
  { id: "circuit", name: "Circuit Lab", phase: 1 },
  { id: "microcontroller", name: "Microcontroller Lab", phase: 2 },
  { id: "iot", name: "IoT Lab", phase: 3 },
  { id: "sensors", name: "Sensors & Actuators Lab", phase: 4 },
  { id: "robotics-2d", name: "2D Robotics Lab", phase: 5 },
  { id: "control", name: "Control Systems Lab", phase: 6 },
  { id: "power", name: "Power Electronics Lab", phase: 6 },
  { id: "robotics-3d", name: "3D Robotics Lab", phase: 7 },
  { id: "ros", name: "ROS Lab", phase: 8 },
  { id: "gesture", name: "Gesture Control Lab", phase: 9 },
] as const satisfies readonly LabInfo[];

export interface LabInfo {
  /** Stable id, used in routes and package names (e.g. `labs/control`). */
  readonly id: string;
  readonly name: string;
  /** Plan phase that delivers the lab (P1–P9). */
  readonly phase: number;
}

export type LabId = (typeof LABS)[number]["id"];
