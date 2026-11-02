// still times (seconds) for shoot.mjs. Flow schedule: combo x2 from 0.6 s, peel 6.0 s, throw 9.6 s, charge 13.0 s, release 14.38 s.
export default {
  flow: [[0.70, '01-jab-windup'], [0.80, '02-jab-hit-stop'], [1.18, '03-swipe-windup'], [1.26, '04-swipe-smear'], [1.30, '05-swipe-hit-stop'],
    [1.70, '06-spin-coil'], [1.85, '07-spin-smear'], [1.95, '08-spin-hit-stop'], [2.15, '09-spin-recovery-follow-through'],
    [6.25, '10-peel-reach'], [6.33, '11-peel-pinch'], [6.55, '12-peel-pull'], [7.50, '13-peel-carry'],
    [9.80, '14-throw-windup'], [9.92, '15-throw-release'], [10.00, '16-throw-follow-through'], [10.35, '17-throw-paper-splat'],
    [13.80, '18-beam-charge-hold'], [14.48, '19-beam-release'], [14.62, '20-beam-recoil']],
  compare: [[0.80, '21-compare-jab'], [1.95, '22-compare-finisher'], [4.60, '23-compare-beam']],
};
