import {wrap360} from './angles.mjs';
import {jstToUtcMs,SAMPLE_INTERVAL_MS} from './time.mjs';

const epoch=jstToUtcMs('2000-01-01','00:00');
const first=jstToUtcMs('1900-01-01','00:00');
const last=jstToUtcMs('2101-01-01','00:00');
export const MOON_PHASES=Object.freeze([
  '新月','三日月','上弦','十三夜月','満月','寝待月','下弦','有明月',
]);


function phaseAt(engine,utcMs) {
  const step=(utcMs-epoch)/SAMPLE_INTERVAL_MS;
  const localStep=step-(engine.startStep??0);
  return wrap360(engine.position(1,localStep).longitude-engine.position(0,localStep).longitude);
}

function result(index) {
  return {index,name:MOON_PHASES[index],angle:index*45};
}

export function moonPhaseAt(engine,utcMs) {
  if (!Number.isFinite(utcMs)||utcMs<first||utcMs>=last) throw new RangeError('Outside supported moon phase interval');
  const angle=phaseAt(engine,utcMs);
  return {...result(Math.floor(angle/45)),elongation:angle};
}

// A half-open interval avoids duplicate events in consecutive queries.
// The Moon gains less than 45° on the Sun during a three-hour search cell.
export function findMoonPhases(engine,startUtcMs,endUtcMs) {
  if (![startUtcMs,endUtcMs].every(Number.isSafeInteger)||startUtcMs<first||endUtcMs>last||startUtcMs>endUtcMs) {
    throw new RangeError('Invalid moon phase search interval');
  }
  const events=[];
  if (startUtcMs===endUtcMs) return events;
  const availableStart=engine.startStep===undefined ? first : epoch+engine.startStep*SAMPLE_INTERVAL_MS;
  const availableEnd=engine.startStep===undefined ? last : availableStart+(engine.count-1)*SAMPLE_INTERVAL_MS;
  if (startUtcMs<availableStart||endUtcMs>availableEnd) throw new RangeError('Search crosses unloaded ephemeris segments');
  let left=Math.max(availableStart,startUtcMs-1);
  let a=phaseAt(engine,left);
  while (left<endUtcMs) {
    const right=Math.min(left+SAMPLE_INTERVAL_MS,endUtcMs);
    const b=phaseAt(engine,Math.min(right,availableEnd-1));
    const advance=wrap360(b-a);
    const target=Math.ceil(a/45)*45;
    if (target-a<=advance) {
      let low=left,high=Math.min(right,availableEnd-1);
      if (target===a) high=low;
      while (high-low>1) {
        const mid=Math.floor((low+high)/2);
        if (wrap360(phaseAt(engine,mid)-a)<target-a) low=mid;
        else high=mid;
      }
      if (high>=startUtcMs && high<endUtcMs && events.at(-1)?.utcMs!==high) events.push({...result((target/45)%8),utcMs:high});
    }
    left=right;
    a=b;
  }
  return events;
}
