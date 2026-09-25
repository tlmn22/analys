// Declarative event taxonomy. Layout/labels/keys are matched to the
// reference tool screenshots. Behavior (what each newly-added button
// actually records) is being filled in step by step — for now everything
// routes through the same generic commit pipeline in tag-workspace.tsx
// (needsPlayer -> player picker scoped to `side`'s team; otherwise a
// direct commit against that team).

export type EventSide = "off" | "def";
export type EventColor = "green" | "red" | "gray" | "blue" | "orange" | "outline";

export interface TypeOption {
  key: string;
  label: string;
}

export interface ModifierOption {
  field: string;
  key: string;
  label: string;
}

/** Config for the shared type-detail panel: player -> optional second
 * player pick -> optional "Alt + X" checkboxes -> a list of blue
 * key-badged type buttons. Used by any event that needs a follow-up
 * detail pick beyond just the player (turnover, off_foul, screen_set,
 * screen_rcvd, ...). */
export interface TypeDetailConfig {
  /** Omit when the type list is exhaustive (e.g. Good/Bad) and no free-form
   * fallback makes sense — the "?" fallback row is only rendered when set. */
  otherLabel?: string;
  types: TypeOption[];
  modifiers?: ModifierOption[];
  /** When true, the type list is picked first and the player second
   * (reversed from the default player -> type order) — e.g. Boxout, where
   * the call quality doesn't depend on who's picked. */
  typeFirst?: boolean;
  /** When set, inserts a second player-pick stage (e.g. "who set the
   * screen?") between the main player pick and the type list. Shown as
   * the stage heading. */
  secondPlayerLabel?: string;
  /** Roster scope for the second-player stage. "teammate" (default): same
   * team as the first player, minus themselves (e.g. who set the screen).
   * "opponent": the other team's on-court 5 (e.g. who was on the other
   * side of a physical battle). */
  secondPlayerOpponent?: boolean;
  /** When set (requires secondPlayerLabel), adds a final "who won?" stage
   * after the type is picked, showing the two players by name. */
  pickWinner?: boolean;
}

export interface EventDef {
  key: string;
  label: string;
  type: string;
  needsPlayer: boolean;
  /** Not tied to offense/defense side and doesn't need a player, but still
   * needs to know which team it belongs to (e.g. Time Out) — shows a plain
   * two-button team picker before committing. */
  needsTeam?: boolean;
  side?: EventSide;
  points?: number;
  color: EventColor;
  /** 2pt_made/2pt_miss/3pt_made/3pt_miss: opens the 3-stage shot-detail
   * modal (player -> modifiers/quality/shot type -> court location)
   * instead of the plain player picker. */
  detailedShot?: boolean;
  /** Opens the shared type-detail panel (player -> optional modifiers +
   * type list) instead of the plain player picker. */
  typeDetail?: TypeDetailConfig;
  /** Not attributable to a single offense/defense side (e.g. a loose-ball
   * foul can happen to anyone) — the player picker shows all 10 on-court
   * players from both teams, and the event's team_id is resolved from
   * whichever player gets picked instead of from `side`. */
  bothTeams?: boolean;
  /** Opens the growable per-game play-name panel (e.g. Set Offense/BLOB/
   * SLOB) instead of a direct commit — every team calls different named
   * plays, so this isn't a fixed taxonomy like typeDetail's lists. */
  playNameDetail?: PlayNameConfig;
}

/** Config for the growable play-name panel: a per-game, per-category list
 * of names (e.g. "Motion", "Zipper") that grows as the analyst adds new
 * ones via "Other X". `outcomes`, if set, adds a second "what happened?"
 * stage after the name is picked (e.g. BLOB/SLOB success-rate tracking). */
export interface PlayNameConfig {
  category: string;
  outcomes?: TypeOption[];
}

/** Boolean modifier checkboxes shown on the shot-detail screen. `field`
 * matches the corresponding game_events column (camelCase on the client,
 * snake_case in the DB — mapped in actions.ts). */
export const SHOT_MODIFIERS: { field: string; label: string }[] = [
  { field: "andOne", label: "and 1" },
  { field: "badMiss", label: "bad miss" },
  { field: "contestedClose", label: "contested (< 0.6 m.)" },
  { field: "lateClock", label: "late clock" },
  { field: "lightlyContested", label: "lightly contested (< 1.2 m.)" },
  { field: "uncontested", label: "uncontested (< 1.8 m.)" },
  { field: "wideOpen", label: "wide open (> 1.8 m.)" },
];

export const SHOT_TYPES_2PT: string[] = [
  "Breakaway Layup",
  "Catch and Shoot",
  "Cut to Basket",
  "Dribble Drive",
  "Dunk",
  "Euro Step",
  "Jump Shot",
  "Layup",
  "Post Move",
  "Pull Up Jumper",
  "Putback",
  "Runner",
  "Other",
];

export const SHOT_TYPES_3PT: string[] = ["Catch and Shoot", "Off the Dribble", "Other"];

/** Assist type list shown on the Assist detail panel, after the passer is
 * picked. */
export const ASSIST_TYPES: TypeOption[] = [
  { key: "", label: "Hockey" },
  { key: "", label: "Led to Free Throws" },
  { key: "", label: "Pass" },
  { key: "", label: "Screen" },
  { key: "", label: "Good move" },
];

/** Turnover type list shown on the turnover-detail panel, after the player
 * is picked. `key` is the reference tool's keyboard shortcut (shown as a
 * badge); blank where the reference tool doesn't assign one. */
export const TURNOVER_TYPES: TypeOption[] = [
  { key: "d", label: "Dribble Lost" },
  { key: "p", label: "Pass Bad" },
  { key: "", label: "Pass Blocked" },
  { key: "P", label: "Pass Dropped" },
  { key: "k", label: "Takeaway" },
  { key: "0", label: "Violation: 10 seconds in backcourt" },
  { key: "3", label: "Violation: 3 Seconds" },
  { key: "5", label: "Violation: 5 Seconds" },
  { key: "b", label: "Violation: Backcourt" },
  { key: "c", label: "Violation: Carry" },
  { key: "D", label: "Violation: Double Dribble" },
  { key: "", label: "Violation: Illegal Inbounds" },
  { key: "i", label: "Violation: Inbound 5 Seconds" },
  { key: "", label: "Violation: Offensive Goaltending" },
  { key: "o", label: "Violation: Out of Bounds" },
  { key: "s", label: "Violation: Shot Clock" },
  { key: "t", label: "Violation: Travel" },
];

/** Call-quality checkboxes shown above the foul type list. `key` is shown
 * as an "Alt + X" badge, matching the reference tool. */
export const OFF_FOUL_MODIFIERS: ModifierOption[] = [
  { field: "fiftyFifty", key: "5", label: "50-50" },
  { field: "badCall", key: "b", label: "Bad Call" },
  { field: "correctCall", key: "c", label: "Correct Call" },
];

export const OFF_FOUL_TYPES: TypeOption[] = [
  { key: "c", label: "Charge" },
  { key: "d", label: "Double Foul" },
  { key: "i", label: "Illegal Screen" },
  { key: "d", label: "Other Offensive Foul" },
  { key: "o", label: "Over the Back" },
];

export const DEF_FOUL_TYPES: TypeOption[] = [
  { key: "1", label: "And 1" },
  { key: "d", label: "Double Foul" },
  { key: "f", label: "Flagrant" },
  { key: "i", label: "Intentional" },
  { key: "b", label: "Non-Shooting (Bonus)" },
  { key: "n", label: "Non-Shooting" },
  { key: "s", label: "Shooting" },
];

export const SCREEN_SET_TYPES: TypeOption[] = [
  { key: "", label: "Back Screen" },
  { key: "", label: "Cross Screen" },
  { key: "", label: "DHO" },
  { key: "", label: "Down Screen" },
  { key: "", label: "Elevator Screen" },
  { key: "", label: "Flare Screen" },
  { key: "", label: "Handoff" },
  { key: "", label: "Pin Down" },
  { key: "p", label: "Pop" },
  { key: "s", label: "Rescreen" },
  { key: "r", label: "Roll" },
  { key: "", label: "Stay" },
];

export const SCREEN_RCVD_TYPES: TypeOption[] = [
  { key: "r", label: "Reject" },
  { key: "u", label: "Use" },
];

export const HUSTLE_PLAY_TYPES: TypeOption[] = [
  { key: "", label: "Diving for Ball" },
  { key: "", label: "Offensive Rebound Effort" },
  { key: "", label: "Defensive Rebound Effort" },
  { key: "", label: "Good Bump" },
];

/** Outcome picked after a BLOB/SLOB play name, for per-play success-rate
 * reporting. */
export const BLOB_SLOB_OUTCOMES: TypeOption[] = [
  { key: "", label: "Score" },
  { key: "", label: "No Score" },
  { key: "", label: "Turnover" },
  { key: "", label: "Continue Offense" },
];

/** Physical-contact type list, inspired by Roland Beech's research on
 * physical-battle impact on game outcomes. Picked after both players
 * involved, followed by a "who won?" stage. */
export const PHYSICAL_CONTACT_TYPES: TypeOption[] = [
  { key: "", label: "Post Seal" },
  { key: "", label: "Post Backdown" },
  { key: "", label: "Box Out (Def)" },
  { key: "", label: "Box Out (Off)" },
  { key: "", label: "50/50 Rebound" },
  { key: "", label: "Ball Screen" },
  { key: "", label: "Screen Navigation" },
  { key: "", label: "Drive Shoulder Contact" },
  { key: "", label: "Loose Ball" },
  { key: "", label: "Rim/Body Contact" },
  { key: "", label: "Shot Contest" },
  { key: "", label: "Charge Draw" },
];

/** Boxout call quality, picked before the player (unlike other typeDetail
 * events) — a boxout is judged good/bad independent of who executed it. */
export const BOXOUT_TYPES: TypeOption[] = [
  { key: "g", label: "Good" },
  { key: "b", label: "Bad" },
];

export const STOPPED: EventDef[] = [
  // Substitution opens the dedicated lineup/substitution modal rather than
  // the generic player picker — see substitution-modal.tsx.
  { key: "y", label: "Substitution", type: "sub", needsPlayer: false, color: "gray" },
  { key: "!", label: "FT Made", type: "ft_made", needsPlayer: true, side: "off", points: 1, color: "green" },
  { key: "1", label: "FT Miss", type: "ft_miss", needsPlayer: true, side: "off", color: "gray" },
  { key: "M", label: "Time Out", type: "timeout", needsPlayer: false, needsTeam: true, color: "blue" },
  { key: "Q", label: "End Quarter", type: "end_quarter", needsPlayer: false, color: "gray" },
];

export const OFFENSE: EventDef[] = [
  { key: "@", label: "2Pt Made", type: "2pt_made", needsPlayer: true, side: "off", points: 2, color: "green", detailedShot: true },
  { key: "#", label: "3Pt Made", type: "3pt_made", needsPlayer: true, side: "off", points: 3, color: "green", detailedShot: true },
  { key: "2", label: "2Pt Miss", type: "2pt_miss", needsPlayer: true, side: "off", color: "gray", detailedShot: true },
  { key: "3", label: "3Pt Miss", type: "3pt_miss", needsPlayer: true, side: "off", color: "gray", detailedShot: true },
  { key: "a", label: "Assist", type: "assist", needsPlayer: true, side: "off", color: "green" },
  {
    key: "t",
    label: "Turnover",
    type: "turnover",
    needsPlayer: true,
    side: "off",
    color: "red",
    typeDetail: { otherLabel: "Other Turnover", types: TURNOVER_TYPES },
  },
  { key: "R", label: "Off Reb", type: "off_reb", needsPlayer: true, side: "off", color: "green" },
  {
    key: "Z",
    label: "Other Assist",
    type: "other_assist",
    needsPlayer: true,
    side: "off",
    color: "outline",
    typeDetail: { otherLabel: "Other Assist", types: ASSIST_TYPES },
  },
  {
    key: "F",
    label: "Off Foul",
    type: "off_foul",
    needsPlayer: true,
    side: "off",
    color: "red",
    typeDetail: { otherLabel: "Other Off Foul", types: OFF_FOUL_TYPES, modifiers: OFF_FOUL_MODIFIERS },
  },
  {
    key: "",
    label: "Screen Set",
    type: "screen_set",
    needsPlayer: true,
    side: "off",
    color: "outline",
    typeDetail: {
      otherLabel: "Other Screen Set",
      types: SCREEN_SET_TYPES,
      secondPlayerLabel: "Who was the screen set for?",
    },
  },
  {
    key: "",
    label: "Screen Rcvd.",
    type: "screen_rcvd",
    needsPlayer: true,
    side: "off",
    color: "outline",
    typeDetail: {
      otherLabel: "Other Screen Received",
      types: SCREEN_RCVD_TYPES,
      secondPlayerLabel: "Who set the screen?",
    },
  },
];

// Individual defensive actions are blue, distinct from the orange used by
// Defensive Team Sets below — matches the reference tool's color split.
export const DEFENSE: EventDef[] = [
  { key: "r", label: "Def Reb", type: "def_reb", needsPlayer: true, side: "def", color: "blue" },
  {
    key: "f",
    label: "Def Foul",
    type: "def_foul",
    needsPlayer: true,
    side: "def",
    color: "red",
    typeDetail: { otherLabel: "Other Def Foul", types: DEF_FOUL_TYPES, modifiers: OFF_FOUL_MODIFIERS },
  },
  { key: "b", label: "Block Shot", type: "block", needsPlayer: true, side: "def", color: "blue" },
  { key: "s", label: "Steal", type: "steal", needsPlayer: true, side: "def", color: "blue" },
  { key: "j", label: "Tie Up", type: "tie_up", needsPlayer: true, side: "def", color: "blue" },
  { key: "g", label: "Take Charge", type: "take_charge", needsPlayer: true, side: "def", color: "blue" },
  { key: "v", label: "Forced TO", type: "forced_to", needsPlayer: true, side: "def", color: "blue" },
  { key: "d", label: "Deflect", type: "deflect", needsPlayer: true, side: "def", color: "blue" },
  { key: "", label: "Good Bump", type: "good_bump", needsPlayer: true, side: "def", color: "blue" },
];

// Always-visible "Other Player Events" — either team's on-court players can
// commit these, so they show all 10 (bothTeams).
export const OTHER: EventDef[] = [
  {
    key: "x",
    label: "Boxout",
    type: "boxout",
    needsPlayer: true,
    color: "gray",
    bothTeams: true,
    typeDetail: { types: BOXOUT_TYPES, typeFirst: true },
  },
];

/** Shown in the "More Other Player Events" overlay, opened from the "Other
 * Player Events" section's "(show more)" link. Not tied to offense/defense
 * — either team's on-court players can commit these. */
export const OTHER_MORE: EventDef[] = [
  { key: "l", label: "Loose Ball Foul", type: "loose_ball_foul", needsPlayer: true, color: "red", bothTeams: true },
  {
    key: "h",
    label: "Hustle Play",
    type: "hustle_play",
    needsPlayer: true,
    color: "gray",
    bothTeams: true,
    typeDetail: { otherLabel: "Other Hustle Play", types: HUSTLE_PLAY_TYPES },
  },
  {
    key: "",
    label: "Physical Contact",
    type: "physical_contact",
    needsPlayer: true,
    color: "red",
    bothTeams: true,
    typeDetail: {
      otherLabel: "Other Physical Contact",
      types: PHYSICAL_CONTACT_TYPES,
      secondPlayerLabel: "Who was on the other side?",
      secondPlayerOpponent: true,
      pickWinner: true,
    },
  },
];

/** Named offensive actions (PnR, screens, formations) — a fixed list of
 * standard basketball terminology, unlike Set Offense/BLOB/SLOB's growable
 * per-team play names. Tagged against the offense team only, no player. */
export const OFFENSE_ACTION_TYPES: TypeOption[] = [
  { key: "", label: "PnR (Pick and Roll)" },
  { key: "", label: "Pick and Pop" },
  { key: "", label: "DHO (Hand-Off)" },
  { key: "", label: "Pin Down" },
  { key: "", label: "Stagger" },
  { key: "", label: "Backdoor Cut" },
  { key: "", label: "Flare Screen" },
  { key: "", label: "Spanish PnR" },
  { key: "", label: "Horns" },
  { key: "", label: "5-out" },
  { key: "", label: "Drag Screen" },
  { key: "", label: "ATO" },
];

export const OFFENSE_TEAM_SETS: EventDef[] = [
  {
    key: "S",
    label: "Set Offense",
    type: "set_offense",
    needsPlayer: false,
    side: "off",
    color: "blue",
    playNameDetail: { category: "set_offense" },
  },
  { key: "I", label: "Transition", type: "transition", needsPlayer: false, side: "off", color: "blue" },
  {
    key: "B",
    label: "BLOB",
    type: "blob",
    needsPlayer: false,
    side: "off",
    color: "blue",
    playNameDetail: { category: "blob", outcomes: BLOB_SLOB_OUTCOMES },
  },
  {
    key: "L",
    label: "SLOB",
    type: "slob",
    needsPlayer: false,
    side: "off",
    color: "blue",
    playNameDetail: { category: "slob", outcomes: BLOB_SLOB_OUTCOMES },
  },
  {
    key: "",
    label: "Action",
    type: "off_action",
    needsPlayer: false,
    side: "off",
    color: "blue",
    typeDetail: { otherLabel: "Other Action", types: OFFENSE_ACTION_TYPES },
  },
];

export const MAN_TO_MAN_TYPES: TypeOption[] = [
  { key: "", label: "Full-court man" },
  { key: "", label: "Half-court man" },
  { key: "", label: "Pressure man" },
  { key: "", label: "Switching man" },
  { key: "", label: "Ice / Down / Hedge" },
];

export const ZONE_TYPES: TypeOption[] = [
  { key: "", label: "2-3" },
  { key: "", label: "3-2" },
  { key: "", label: "1-3-1" },
  { key: "", label: "2-1-2" },
];

export const PRESS_TYPES: TypeOption[] = [
  { key: "", label: "Full Court Man to Man" },
  { key: "", label: "Half Court Man to Man" },
  { key: "", label: "1-2-2" },
  { key: "", label: "2-2-1" },
  { key: "", label: "1-3-1" },
  { key: "", label: "Diamond" },
];

/** On-ball PnR coverage calls. Tagged against the defense team only, no
 * player. */
export const DEF_COVERAGE_TYPES: TypeOption[] = [
  { key: "", label: "Drop" },
  { key: "", label: "Hedge (Show)" },
  { key: "", label: "Hard Hedge / Blitz" },
  { key: "", label: "Switch" },
  { key: "", label: "Ice (Push/Blue)" },
  { key: "", label: "Weak" },
  { key: "", label: "Under" },
  { key: "", label: "Over" },
];

/** How the defense navigated an off-ball screen. Tagged against the
 * defense team only, no player. */
export const DEF_OFFBALL_TYPES: TypeOption[] = [
  { key: "", label: "Lock and Trail" },
  { key: "", label: "Top Lock" },
  { key: "", label: "Shoot the Gap" },
  { key: "", label: "Switch (off-ball)" },
];

export const DEFENSE_TEAM_SETS: EventDef[] = [
  {
    key: "m",
    label: "Man to Man",
    type: "man_to_man",
    needsPlayer: false,
    side: "def",
    color: "orange",
    typeDetail: { otherLabel: "Other Man to Man", types: MAN_TO_MAN_TYPES },
  },
  {
    key: "z",
    label: "Zone",
    type: "zone",
    needsPlayer: false,
    side: "def",
    color: "orange",
    typeDetail: { otherLabel: "Other Zone", types: ZONE_TYPES },
  },
  {
    key: "P",
    label: "Press",
    type: "press",
    needsPlayer: false,
    side: "def",
    color: "orange",
    typeDetail: { otherLabel: "Other Press", types: PRESS_TYPES },
  },
  { key: "O", label: "Other Defense", type: "other_defense", needsPlayer: false, side: "def", color: "orange" },
  {
    key: "",
    label: "PnR Coverage",
    type: "def_coverage",
    needsPlayer: false,
    side: "def",
    color: "orange",
    typeDetail: { otherLabel: "Other Coverage", types: DEF_COVERAGE_TYPES },
  },
  {
    key: "",
    label: "Off-Ball D",
    type: "def_offball",
    needsPlayer: false,
    side: "def",
    color: "orange",
    typeDetail: { otherLabel: "Other Off-Ball D", types: DEF_OFFBALL_TYPES },
  },
];

export function findByKey(events: EventDef[], key: string): EventDef | undefined {
  return events.find((e) => e.key !== "" && e.key === key);
}

// Event types that unambiguously end the current offensive possession —
// tagging one of these auto-swaps Off/Def in tag-workspace.tsx so the next
// player-picker shows the right team's roster without a manual "swap" tap.
// Also used server-side (page.tsx) to reconstruct which team was on
// offense when the tag page is reopened mid-game. FT Made/Miss are
// deliberately excluded: a single free throw doesn't reliably mean the
// trip is over (1-and-1, 2, or 3 shots all look the same as one FT tag).
// Steal is included alongside Turnover so a live fast break after a steal
// immediately shows the right team's roster — if an analyst tags both
// Steal and Turnover for the same play, this flips twice and needs a
// manual correction via the swap buttons (the accepted trade-off).
export const AUTO_FLIP_TYPES = new Set(["2pt_made", "3pt_made", "turnover", "steal", "def_reb"]);

/** Flat list of event types that make sense to reassign via the "Edit
 * Event" modal — excludes Substitution (paired sub_in/sub_out + roster
 * state) and End Quarter (increments the period / resets the clock as a
 * live side effect), neither of which is safe to silently reassign after
 * the fact. */
export const EDITABLE_EVENTS: EventDef[] = [
  ...STOPPED.filter((e) => e.type !== "sub" && e.type !== "end_quarter"),
  ...OFFENSE,
  ...DEFENSE,
  ...OTHER,
  ...OTHER_MORE,
  ...OFFENSE_TEAM_SETS,
  ...DEFENSE_TEAM_SETS,
];

/** For the Edit Event modal's "Type" dropdown — which fixed type list
 * applies to a given event type, if any. Events with a modifiers/
 * second-player stage (Off Foul, Def Foul, Screen Received, Physical
 * Contact) only expose their primary type here — the extra fields aren't
 * editable through this generic modal. */
export const TYPE_OPTIONS_BY_EVENT: Record<string, TypeOption[] | undefined> = {
  boxout: BOXOUT_TYPES,
  turnover: TURNOVER_TYPES,
  off_foul: OFF_FOUL_TYPES,
  def_foul: DEF_FOUL_TYPES,
  screen_set: SCREEN_SET_TYPES,
  screen_rcvd: SCREEN_RCVD_TYPES,
  hustle_play: HUSTLE_PLAY_TYPES,
  man_to_man: MAN_TO_MAN_TYPES,
  zone: ZONE_TYPES,
  press: PRESS_TYPES,
  physical_contact: PHYSICAL_CONTACT_TYPES,
  other_assist: ASSIST_TYPES,
  off_action: OFFENSE_ACTION_TYPES,
  def_coverage: DEF_COVERAGE_TYPES,
  def_offball: DEF_OFFBALL_TYPES,
};

/** Event types whose "type" is a free-form per-game name (Set Offense/
 * BLOB/SLOB) rather than a fixed list — edited as plain text instead of a
 * dropdown. */
export const FREE_TEXT_TYPE_EVENTS = new Set(["set_offense", "blob", "slob"]);
