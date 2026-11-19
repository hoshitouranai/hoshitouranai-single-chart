import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadEphemerisSegment,BODY_NAMES} from '../common-engine-inspection/common-engine/src/ephemeris.mjs';
import {findMoonPhases} from '../common-engine-inspection/common-engine/src/moon-phases.mjs';
const path=name=>new URL(name,import.meta.url);
const engine=await loadEphemerisSegment('2000-01-01');
const base=Date.parse('2000-01-01T00:00:00+09:00');
const end=Date.parse('2051-01-01T00:00:00+09:00');
const stepMs=10800000;
const wrap=a=>(a%360+540)%360-180;
const ingresses=BODY_NAMES.map((_,body)=>{
 const lon=t=>engine.position(body,t).longitude;
 const got=[];
 const span=(end-base)/stepMs;
 // Ten-minute subintervals also detect short intervals straddling a station.
 for(let i=0, a=lon(0);i<span*18;i++){
  const b=lon(Math.min((i+1)/18,span-1/stepMs)), d=wrap(b-a), q=a+d;
  const boundary=d>0?30*(Math.floor(a/30)+1):30*(Math.ceil(a/30)-1);
  if((d>0&&q>=boundary)||(d<0&&q<=boundary)){
   let lo=i/18, hi=(i+1)/18;
   for(let j=0;j<25;j++){const mid=(lo+hi)/2;if(Math.sign(wrap(lon(mid)-boundary))===Math.sign(d))hi=mid;else lo=mid;}
   got.push({ms:base+hi*stepMs,sign:((boundary/30-(d<0?1:0))%12+12)%12,retro:d<0});
  }
  a=b;
 }
 return got;
});
const direct=(mode,events)=>JSON.parse(execFileSync('python3',[fileURLToPath(path('refine.py'))],{
 input:JSON.stringify([mode,events]), encoding:'utf8'
}));
const uranus=ingresses[7];
direct('uranus',uranus.map(({ms,sign,retro})=>[ms,sign,Number(retro)])).forEach((ms,i)=>uranus[i].ms=ms);
const phases=findMoonPhases(engine,base,end);
const phaseTimes=phases.filter(x=>x.angle===0||x.angle===180).map(x=>x.utcMs);
const eventTimes=[...new Set([...phaseTimes,...ingresses.flatMap(events=>events.map(x=>x.ms))])];
const nodeFlags=new Map(direct('node',eventTimes).map((retro,i)=>[eventTimes[i],retro]));
const format=ms=>new Date(Math.floor((ms+30000)/60000)*60000+32400000).toISOString().slice(0,16).replaceAll('-','/').replace('T',' ');
const sample=ms=>(ms-base)/stepMs;
const eventData=Object.fromEntries(Array.from({length:51},(_,i)=>[2000+i,Object.fromEntries(['new0','full0',...BODY_NAMES.map((_,j)=>'ingress'+j)].map(k=>[k,[]]))]));
function add(key,ms,sign,reverse) {
 const step=sample(ms);
 const {theta,obliquity}=engine.orientation(step);
 const positions=BODY_NAMES.map((_,i)=>engine.position(i,step));
 const retro=positions.reduce((mask,p,i)=>mask+((i===10?nodeFlags.get(ms):p.retrograde)?1<<i:0),0);
 const date=format(ms);
 const group=eventData[date.slice(0,4)];
 if(!group)throw Error('Display date outside supported years: '+date);
 group[key].push([date,sign,Number(reverse),+theta.toFixed(9),+obliquity.toFixed(9),positions.map(p=>+p.longitude.toFixed(8)),retro]);
}
const phaseGroups={solar:phases.filter(x=>x.angle===0),lunar:phases.filter(x=>x.angle===180)};
for(const [type,events] of Object.entries(phaseGroups)){
 for(const {utcMs} of events) add(type==='solar'?'new0':'full0',utcMs,Math.floor(engine.position(1,sample(utcMs)).longitude/30),false);
}
ingresses.forEach((events,i)=>events.forEach(({ms,sign,retro})=>add('ingress'+i,ms,sign,retro)));
const eclipses={};
const peaks=JSON.parse(readFileSync(path('eclipse-peaks.json'),'utf8'));
for(const [type,events] of Object.entries(peaks))for(const [peak,kind] of events){
 const hits=phaseGroups[type].filter(x=>Math.abs(x.utcMs-peak)<86400000);
 if(hits.length!==1)throw Error('Eclipse counterpart missing');
 const date=format(hits[0].utcMs);
 if(date in eclipses)throw Error('Duplicate eclipse date');
 eclipses[date]=kind;
}
const template=readFileSync(path('template.html'),'utf8');
const html=template.replace('__REPLACE_eventData__',JSON.stringify(eventData)).replace('__REPLACE_eclipses__',JSON.stringify(eclipses)).replace('let year = 1889','let year = 2000');
writeFileSync(path('index.html'),html);
writeFileSync(path('eventData.json'),JSON.stringify(eventData));
writeFileSync(path('eclipses.json'),JSON.stringify(eclipses));
