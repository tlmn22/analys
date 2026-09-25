export type Gender = "male" | "female";
export type SeasonStatus = "active" | "inactive";
export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C";
export type ClubStaffRole = "owner" | "manager" | "head_coach" | "assistant_coach" | "player";
export type ClubEventType = "gym_prep" | "fitness_prep" | "team_meeting" | "other";
export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "sick";
export type GameType =
  | "league"
  | "division"
  | "non_conference"
  | "tournament"
  | "playoff"
  | "pre_season"
  | "scrimmage";

export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  gender: Gender;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  logo_url: string | null;
  sponsor_name: string | null;
  sponsor_logo_url: string | null;
  created_at: string;
}

/** Public-facing shape — deliberately excludes password_hash so it never
 * ends up in a page/component that doesn't need it. */
export interface ClubStaff {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: ClubStaffRole;
  created_at: string;
}

export interface ClubStaffWithClub extends ClubStaff {
  club: Pick<Club, "id" | "name">;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  name: string;
  event_type: ClubEventType;
  location: string | null;
  start_at: string;
  end_at: string;
  description: string | null;
  created_at: string;
}

export interface ClubEventWithClub extends ClubEvent {
  club: Pick<Club, "id" | "name">;
}

export interface ClubEventAttendance {
  id: string;
  event_id: string;
  club_staff_id: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  created_at: string;
}

export interface Player {
  id: string;
  photo_url: string | null;
  first_name: string;
  last_name: string;
  active: boolean;
  position: PlayerPosition;
  created_at: string;
}

export interface SeasonTeam {
  id: string;
  season_id: string;
  team_id: string;
  created_at: string;
}

export interface SeasonTeamWithTeam extends SeasonTeam {
  team: Pick<Team, "id" | "name" | "logo_url">;
}

export interface Roster {
  id: string;
  season_team_id: string;
  player_id: string;
  number: number;
  created_at: string;
}

export interface RosterWithPlayer extends Roster {
  player: Pick<Player, "id" | "first_name" | "last_name" | "photo_url" | "position">;
}

export interface Game {
  id: string;
  season_id: string;
  home_team_id: string;
  home_team_color: string | null;
  visitor_team_id: string;
  visitor_team_color: string | null;
  location: string | null;
  game_type: GameType;
  game_date: string | null;
  video_url: string | null;
  created_at: string;
}

export interface GameWithTeams extends Game {
  home_team: Pick<Team, "id" | "name">;
  visitor_team: Pick<Team, "id" | "name">;
}

export interface GameLineupSlot {
  id: string;
  game_id: string;
  team_id: string;
  slot: number;
  player_id: string | null;
}

export interface GameEvent {
  id: string;
  game_id: string;
  period: number;
  clock_time: number;
  video_time: number;
  event_type: string;
  team_id: string | null;
  player_id: string | null;
  assist_player_id: string | null;
  points: number | null;
  created_at: string;
}

export const POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: "PG", label: "PG — Point Guard" },
  { value: "SG", label: "SG — Shooting Guard" },
  { value: "SF", label: "SF — Small Forward" },
  { value: "PF", label: "PF — Power Forward" },
  { value: "C", label: "C — Center" },
];

export const GAME_TYPES: { value: GameType; label: string }[] = [
  { value: "league", label: "League" },
  { value: "division", label: "Division" },
  { value: "non_conference", label: "Non-Conference" },
  { value: "tournament", label: "Tournament" },
  { value: "playoff", label: "Playoff" },
  { value: "pre_season", label: "Pre-Season" },
  { value: "scrimmage", label: "Scrimmage" },
];
