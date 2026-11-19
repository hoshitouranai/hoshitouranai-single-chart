// v1: Strict, timezone-independent Japanese Standard Time (UTC+09:00), no DST.
// Birth charts in other historical timezones are NOT implemented yet.
const BASE = Date.UTC(2000,0,1,0,0,0);
const STEP_MS = 3*3600*1000;
const JST_SHIFT_MS = 9*3600*1000;
function parseWallClock(ymd, hm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hm)) throw new RangeError('Expected YYYY-MM-DD and HH:mm');
  const [y,m,d] = ymd.split('-').map(Number), [h,min] = hm.split(':').map(Number);
  const ms=Date.UTC(y,m-1,d,h,min);
  const dt=new Date(ms);
  if (dt.getUTCFullYear()!==y || dt.getUTCMonth()+1!==m || dt.getUTCDate()!==d) throw new RangeError('Invalid calendar date');
  return ms;
}
export function jstToUtcMs(ymd, hm) {return parseWallClock(ymd,hm)-JST_SHIFT_MS;}
export function utcMsToJst(utcMs) {
  if (!Number.isFinite(utcMs)) throw new RangeError('Invalid UTC epoch');
  const d=new Date(utcMs+JST_SHIFT_MS);
  return {date:[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-'),time:`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`};
}
// The source gantt's step explicitly indexes JST civil clock labels using a pseudo-UTC Date.parse.
// Do not replace this with true UTC seconds without reindexing the underlying sample data.
export function jstSampleStep(ymd, hm) {return (parseWallClock(ymd,hm)-BASE)/STEP_MS;}
export const SAMPLE_INTERVAL_MS=STEP_MS;
export const SAMPLE_EPOCH_LABEL='2000-01-01 00:00 JST';
