import type { EventColor } from "./tag-events";

/** Solid, vivid Tailwind classes per event color — shared by action-panel
 * buttons, event-log pills, and the "more events" overlay so the whole tag
 * workspace uses one consistent color language (matching the reference
 * tool's dark, saturated look). */
export const SOLID_CLASSES: Record<EventColor, string> = {
  green: "bg-green-600 hover:bg-green-500 text-white",
  red: "bg-red-600 hover:bg-red-500 text-white",
  gray: "bg-neutral-700 hover:bg-neutral-600 text-white",
  blue: "bg-blue-600 hover:bg-blue-500 text-white",
  orange: "bg-orange-500 hover:bg-orange-400 text-white",
  outline: "border border-neutral-600 bg-transparent hover:bg-neutral-800 text-neutral-300",
};

/** Same palette without hover states, for static badges/pills (events log)
 * rather than interactive buttons. */
export const PILL_CLASSES: Record<EventColor, string> = {
  green: "bg-green-600 text-white",
  red: "bg-red-600 text-white",
  gray: "bg-neutral-700 text-white",
  blue: "bg-blue-600 text-white",
  orange: "bg-orange-500 text-white",
  outline: "bg-neutral-800 text-neutral-300",
};
