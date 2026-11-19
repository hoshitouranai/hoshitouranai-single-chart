import {wrap360} from './angles.mjs';
import {jstSampleStep} from './time.mjs';
export const BODY_NAMES=Object.freeze(['太陽','月','水星','金星','火星','木星','土星','天王星','海王星','冥王星','ドラゴンヘッド','キロン']);
const SCALE=1e7, STRIDE=BODY_NAMES.length*8;
export class SampledEphemeris {
  constructor(ephemerisBytes,earthBytes,stations, startStep = 0) {
    this.planet=new DataView(asArrayBuffer(ephemerisBytes));
    this.earth=new DataView(asArrayBuffer(earthBytes));
    this.stations=stations;
    this.startStep=startStep;
    this.count=this.planet.byteLength/STRIDE;
    if (!Number.isInteger(this.count) || this.earth.byteLength!==this.count*8 || stations.length!==BODY_NAMES.length) throw new Error('Sample data size mismatch');
  }
  checkStep(step){if(!Number.isFinite(step)||step<0||step>=this.count-1)throw new RangeError('Outside supported sample interval');}
  position(index,step) {
    this.checkStep(step);
    if(!Number.isInteger(index)||index<0||index>=BODY_NAMES.length)throw new RangeError('Invalid body index');
    const sample=Math.floor(step), t=step-sample, offset=sample*STRIDE+index*8;
    const p0=this.planet.getInt32(offset,true)/SCALE,v0=this.planet.getInt32(offset+4,true)/SCALE;
    const p1=this.planet.getInt32(offset+STRIDE,true)/SCALE,v1=this.planet.getInt32(offset+STRIDE+4,true)/SCALE;
    const delta=wrap360(p1-p0+180)-180;
    const longitude=wrap360(p0+delta*t*t*(3-2*t)+t*(1-t)*(v0*(1-t)-v1*t)/8);
    const changes=this.stations[index],minute=Math.round(step*180);
    let lo=1,hi=changes.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(changes[mid]<=minute)lo=mid+1;else hi=mid;}
    return {name:BODY_NAMES[index],longitude,retrograde:Boolean((changes[0]+lo-1)%2)};
  }
  orientation(step) {
    this.checkStep(step);
    const i=Math.floor(step),f=step-i,o=i*8;
    const a=this.earth.getUint32(o,true)/SCALE,b=this.earth.getUint32(o+8,true)/SCALE;
    const eps=this.earth.getUint32(o+4,true)/SCALE,nextEps=this.earth.getUint32(o+12,true)/SCALE;
    return {theta:wrap360(a+f*wrap360(b-a)),obliquity:eps+f*(nextEps-eps)};
  }
  chart(ymd,hm,indices=BODY_NAMES.map((_,i)=>i)) {
    const step=jstSampleStep(ymd,hm);
    const localStep=step-this.startStep;
    return {date:ymd,time:hm,timeZone:'Asia/Tokyo',step,orientation:this.orientation(localStep),bodies:indices.map(i=>this.position(i,localStep))};
  }
}
function asArrayBuffer(bytes) {
  if(bytes instanceof ArrayBuffer)return bytes;
  if(!(bytes instanceof Uint8Array))throw new TypeError('Expected binary buffer');
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
const PERIODS = [
  {start: '1900-01-01', end: '2000-01-01', label: '1900_1999'},
  {start: '2000-01-01', end: '2051-01-01', label: '2000_2050'},
  {start: '2051-01-01', end: '2101-01-01', label: '2051_2100'},
].map(period => ({
  ...period, first: jstSampleStep(period.start, '00:00'),
  last: jstSampleStep(period.end, '00:00'),
}));

export async function loadEphemerisSegment(date, baseUrl=new URL('../data/',import.meta.url), read=fetchSample) {
  const step = jstSampleStep(date, '00:00');
  const period = PERIODS.find(({first,last}) => step >= first && step < last);
  if (!period) throw new RangeError('天文暦の対応期間は1900年1月1日〜2100年12月31日（JST）です');
  const {label,first,last} = period;
  const files = [
    `ephemeris_${label}_3h.bin`, `earth_orientation_${label}_3h.bin`,
    first === 0 ? 'stations.json' : `stations_${label}.json`,
  ];
  const [planet,earth,stations] = await Promise.all(files.map(name => read(new URL(name,baseUrl))));
  const segment = new SampledEphemeris(planet,earth,stations,first);
  if (segment.count !== last-first+1) throw new Error('Ephemeris segment length mismatch');
  return segment;
}

async function fetchSample(url) {
  if (url.protocol === 'file:' && globalThis.process?.versions?.node) {
    const {readFile} = await import('node:fs/promises');
    const bytes = await readFile(url);
    return url.pathname.endsWith('.json') ? JSON.parse(bytes.toString('utf8')) : bytes;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed loading ${url.pathname}: ${response.status}`);
  return url.pathname.endsWith('.json') ? response.json() : response.arrayBuffer();
}

// Preserve the synchronous chart API after loading and the existing step origin.
export async function loadSampledEphemeris(baseUrl, read) {
  const segments = await Promise.all(PERIODS.map(({start}) => loadEphemerisSegment(start,baseUrl,read)));
  function forStep(step) {
    const index = PERIODS.findIndex(({first,last}) => step >= first && step < last);
    if (index < 0) throw new RangeError('Outside 1900–2100 JST sample interval');
    return segments[index];
  }
  return {
    count: PERIODS.at(-1).last-PERIODS[0].first+1,
    position(index,step) {
      const segment = forStep(step);
      return segment.position(index,step-segment.startStep);
    },
    orientation(step) {
      const segment = forStep(step);
      return segment.orientation(step-segment.startStep);
    },
    chart(date,time,indices) {
      return forStep(jstSampleStep(date,time)).chart(date,time,indices);
    },
  };
}
