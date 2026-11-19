export const wrap360 = angle => ((angle % 360)+360)%360;
export function shortestSeparation(a,b) {return Math.abs(((wrap360(a-b)+180)%360)-180);}
export function zodiacPosition(longitude) {
  if (!Number.isFinite(longitude)) throw new RangeError('Invalid longitude');
  const norm=wrap360(longitude);
  return {signIndex:Math.floor(norm/30),degreesInSign:norm%30};
}
