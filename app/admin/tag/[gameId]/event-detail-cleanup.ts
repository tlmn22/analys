// Omitted fields keep their existing values; only incompatible details are cleared.
export function eventDetailCleanup(eventType: string) {
  const shot = /^(2pt|3pt)_(made|miss)$/.test(eventType);
  const made = shot && eventType.endsWith("_made");
  return {
    database: {
      ...(!shot && {
        shot_type: null, shot_x: null, shot_y: null, shot_quality: null,
        contested_close: false, late_clock: false, lightly_contested: false,
        uncontested: false, wide_open: false, defender_player_id: null,
      }),
      ...(!made && { assist_player_id: null, and_one: false }),
      ...(!(shot && !made) && { bad_miss: false }),
      ...(!["off_foul", "def_foul"].includes(eventType) && {
        foul_fifty_fifty: false, foul_bad_call: false, foul_correct_call: false,
      }),
      ...(eventType !== "screen_rcvd" && { screener_player_id: null }),
      ...(eventType !== "screen_set" && { screen_target_player_id: null }),
      ...(eventType !== "physical_contact" && {
        physical_contact_second_player_id: null, physical_contact_winner_player_id: null,
      }),
      ...(eventType !== "blob" && { blob_outcome: null }),
      ...(eventType !== "slob" && { slob_outcome: null }),
    },
    display: {
      ...(!shot && { shotType: null, defenderLabel: null }),
      ...(!made && { assistPlayerLabel: null, assistPlayerId: null }),
      ...(eventType !== "screen_rcvd" && { screenerLabel: null }),
      ...(eventType !== "screen_set" && { screenTargetLabel: null }),
      ...(eventType !== "physical_contact" && {
        physicalContactSecondLabel: null, physicalContactWinnerLabel: null,
      }),
      ...(eventType !== "blob" && { blobOutcome: null }),
      ...(eventType !== "slob" && { slobOutcome: null }),
    },
  };
}
