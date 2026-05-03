/**
 * End-of-run score adjustments from runtime cheat flags (read at win / loss).
 * Benefit cheats subtract; difficulty cheats add. `nocheats` clears flags first.
 */

/** @returns {{ label: string, value: number }[]} */
export function getCheatScoreAdjustments(game) {
  if (!game) return [];
  const o = [];
  if (game.pickAnyWeapon) {
    o.push({ label: "Easy forge (Dez / pick-any weapons)", value: -2400 });
  }
  if (game.pinkFloydMode) {
    o.push({ label: "Pink Floyd gauntlet bonus", value: 1700 });
  }
  if (game.jillyMode) {
    o.push({ label: "Jilly climb hazard swap", value: -2100 });
  }
  if (game.bubblegumMode) {
    o.push({ label: "Bubblegum (extra guardians & pact seals)", value: -2800 });
  }
  if (game.easyMode) {
    o.push({ label: "Wyrm easy bias", value: -3400 });
  }
  if (game.hardMode) {
    o.push({ label: "Dragon hard bias bonus", value: 2600 });
  }
  if (game.rowanWeirdWeapons) {
    o.push({ label: "Rowan rowdy-only forge", value: -900 });
  }
  if (game.lemonBoost) {
    o.push({ label: "Lemon climb speed boost", value: -700 });
  }
  return o;
}
