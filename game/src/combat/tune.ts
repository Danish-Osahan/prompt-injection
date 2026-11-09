/** Live-tunable combat numbers for ?combat=1&tune=1 (defaults from docs/design/combat.md). */
export type CombatTune = {
  noorHp: number;
  inkMax: number;
  inkStart: number;
  inkHit: [number, number, number];
  inkPeel: number;
  inkBeam: number;
  dashCd: number;
  dashIframes: number;
  holdBeam: number;
  beamRange: number;
  beamDmg: number;
  beamCd: number;
  aimR: number;
  comboDmg: [number, number, number];
  hitStop: [number, number, number];
  scribbleHp: number;
  scribbleAggro: number;
  scribbleLungeWind: number;
  scribbleLungeActive: number;
  scribbleStuck: number;
  redlineHp: number;
  redlineAggro: number;
  redlineScrape: number;
  redlineChargeSpd: number;
  redlineStun: number;
  staplerHp: number;
  staplerAggro: number;
  staplerSnapWind: number;
  staplerSnapActive: number;
  staplerSnapRecover: number;
};

export const DEFAULT_TUNE: CombatTune = {
  noorHp: 5,
  inkMax: 100,
  inkStart: 60,
  inkHit: [8, 10, 14],
  inkPeel: 15,
  inkBeam: 50,
  dashCd: 1.0,
  dashIframes: 0.22,
  holdBeam: 0.85,
  beamRange: 96,
  beamDmg: 5,
  beamCd: 4.0,
  aimR: 150,
  comboDmg: [1, 1.5, 2.5],
  hitStop: [0.05, 0.06, 0.09],
  scribbleHp: 3,
  scribbleAggro: 220,
  scribbleLungeWind: 0.6,
  scribbleLungeActive: 0.18,
  scribbleStuck: 1.0,
  redlineHp: 5,
  redlineAggro: 280,
  redlineScrape: 0.4,
  redlineChargeSpd: 320,
  redlineStun: 1.5,
  staplerHp: 6,
  staplerAggro: 200,
  staplerSnapWind: 0.45,
  staplerSnapActive: 0.16,
  staplerSnapRecover: 0.9,
};
