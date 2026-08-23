import type { EventColor } from "@/lib/tag-events";

export interface RosterPlayer {
  playerId: string;
  number: number;
  firstName: string;
  lastName: string;
  position: string | null;
}

export interface TeamInfo {
  id: string;
  name: string;
  color: string | null;
  roster: RosterPlayer[];
}

/** Shared display label used everywhere a player is shown during tagging —
 * first name leading, matching how the reports pages already show names. */
export function playerLabel(p: RosterPlayer): string {
  return `#${p.number} ${p.firstName} ${p.lastName}`;
}

export interface TaggedEvent {
  id: string;
  period: number;
  clockTime: number;
  videoTime: number;
  eventType: string;
  label: string;
  color: EventColor;
  teamId: string | null;
  playerId: string | null;
  playerLabel: string | null;
  assistPlayerLabel: string | null;
  points: number | null;
  keyEvent: boolean;
  shotType?: string | null;
  defenderLabel?: string | null;
  assistType?: string | null;
  turnoverType?: string | null;
  foulType?: string | null;
  screenSetType?: string | null;
  screenRcvdType?: string | null;
  screenerLabel?: string | null;
  hustlePlayType?: string | null;
  setOffenseName?: string | null;
  blobPlayName?: string | null;
  blobOutcome?: string | null;
  slobPlayName?: string | null;
  slobOutcome?: string | null;
  manToManType?: string | null;
  zoneType?: string | null;
  offActionType?: string | null;
  defCoverageType?: string | null;
  defOffballType?: string | null;
  physicalContactType?: string | null;
  physicalContactSecondLabel?: string | null;
  physicalContactWinnerLabel?: string | null;
}

export interface ShotDetails {
  andOne: boolean;
  badMiss: boolean;
  contestedClose: boolean;
  lateClock: boolean;
  lightlyContested: boolean;
  uncontested: boolean;
  wideOpen: boolean;
  shotQuality: number | null;
  shotType: string;
  shotX: number | null;
  shotY: number | null;
}
