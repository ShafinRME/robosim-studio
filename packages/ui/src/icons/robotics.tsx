import { createIcon } from "@robosim/ui/icons/create-icon";

// RoboSim Studio's own electronics & robotics icons (original artwork, ADR 002).
// Drawn on the 24 px Lucide grid with 2 px strokes so they mix with Lucide UI icons.

export const ResistorIcon = createIcon(
  "ResistorIcon",
  <path d="M2 12h4l1.5-4 3 8 3-8 3 8 1.5-4h4" />,
);

export const CapacitorIcon = createIcon(
  "CapacitorIcon",
  <path d="M2 12h7M15 12h7M9 6v12M15 6v12" />,
);

export const InductorIcon = createIcon(
  "InductorIcon",
  <path d="M2 14h2a2 2 0 0 1 4 0 2 2 0 0 1 4 0 2 2 0 0 1 4 0 2 2 0 0 1 4 0h2" />,
);

export const LedIcon = createIcon(
  "LedIcon",
  <>
    <path d="M2 14h5M16 14h6M16 9v10M7 9v10l9-5z" />
    <path d="m11 6 2.5-2.5M12 3.5h1.5V5M15 7l2.5-2.5M16 4.5h1.5V6" />
  </>,
);

export const TransistorIcon = createIcon(
  "TransistorIcon",
  <>
    <circle cx="13" cy="12" r="8" />
    <path d="M3 12h7M10 8v8M10 10l5-3.5V3M10 14l5 3.5V21" />
  </>,
);

export const GroundIcon = createIcon("GroundIcon", <path d="M12 3v9M5 12h14M8 16h8M11 20h2" />);

export const MicrocontrollerIcon = createIcon(
  "MicrocontrollerIcon",
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <rect x="9" y="10.5" width="7" height="5" rx="0.75" />
    <path d="M6 8h.01M9 8h.01M12 8h.01M15 8h.01M18 8h.01M2.5 10.5H5v4H2.5" />
  </>,
);

export const ServoIcon = createIcon(
  "ServoIcon",
  <>
    <rect x="3" y="10" width="14" height="10" rx="1.5" />
    <path d="M1 12.5h2M17 12.5h2" />
    <circle cx="8" cy="10" r="2" />
    <path d="M9.6 8.8 16 5" />
    <circle cx="17.5" cy="4.2" r="1.5" />
  </>,
);

export const DcMotorIcon = createIcon(
  "DcMotorIcon",
  <>
    <circle cx="10" cy="12" r="7.5" />
    <path d="M7 15V9l3 3.5L13 9v6M17.5 12H22" />
  </>,
);

export const RobotArmIcon = createIcon(
  "RobotArmIcon",
  <>
    <path d="M3 21h10M8 21v-3M8 18 6 11.75M7.6 10.4l5-3.3" />
    <circle cx="6" cy="10.5" r="1.75" />
    <circle cx="14" cy="6" r="1.75" />
    <path d="M15.5 5 19 3M15.6 7.1l3.6 1.2" />
  </>,
);

export const UltrasonicIcon = createIcon(
  "UltrasonicIcon",
  <>
    <rect x="2" y="7" width="20" height="10" rx="2" />
    <circle cx="7.5" cy="12" r="2.75" />
    <circle cx="16.5" cy="12" r="2.75" />
  </>,
);

export const OscilloscopeIcon = createIcon(
  "OscilloscopeIcon",
  <>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M5 11c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0M8 21h8M12 17v4" />
  </>,
);

/** Every custom icon, for the UI kit and tests. */
export const ROBOTICS_ICONS = {
  Resistor: ResistorIcon,
  Capacitor: CapacitorIcon,
  Inductor: InductorIcon,
  LED: LedIcon,
  Transistor: TransistorIcon,
  Ground: GroundIcon,
  Microcontroller: MicrocontrollerIcon,
  Servo: ServoIcon,
  "DC motor": DcMotorIcon,
  "Robot arm": RobotArmIcon,
  Ultrasonic: UltrasonicIcon,
  Oscilloscope: OscilloscopeIcon,
} as const;
