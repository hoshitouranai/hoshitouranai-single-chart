import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(process.argv[2],'utf8');
const downloads=[];
const shared=[];
const apple=process.argv.includes('--apple');
const canvas=new Proxy({measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{
 get:(t,k)=>k in t?t[k]:()=>{}
});
class Element {
 options=[]; events={}; disabled=false; complete=true; naturalWidth=32;
 add(o){this.options.push(o); if(this.options.length===1)this.value=o.value;}
 append(...a){this.options.push(...a);}
 replaceChildren(...a){this.options=a;this.value=a[0]?.value??'';}
 set value(x){this.v=String(x);}
 get value(){return this.v??'';}
 get valueAsNumber(){return Number(this.value);}
 get selectedOptions(){return this.options.filter(o=>o.value===this.value);}
 addEventListener(k,f){this.events[k]=f;}
 getContext(){return canvas;}
 toDataURL(){return 'data:image/png;base64,AA==';}
 click(){downloads.push(this.download);}
 remove(){}
 scrollIntoView(){}
}
const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
const Option=(text,value)=>({text:String(text),value:String(value)});
function BrowserOption(text,value){return Option(text,value);}
for(const [key,values] of Object.entries({kind:[['新月','new'],['満月','full'],['サイン入座','ingress']],sign:[['すべて','']],office:[['手入力','']]}))
 values.forEach(pair=>ids[key].add(Option(...pair)));
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{
 document:{getElementById:id=>ids[id],createElement:()=>new Element(),body:new Element()},
 Path2D:class {},Blob,File,atob,navigator:{userAgent:apple?'iPad':'',platform:'',maxTouchPoints:0,canShare:({files})=>files.length===1,share:({files})=>{shared.push(...files);return Promise.resolve();}},Option:BrowserOption,URL:{createObjectURL:()=> 'blob:mock',revokeObjectURL(){}},setTimeout:f=>f()
});
assert.equal(ids.year.options.length,51);
assert.equal(ids.year.options[0].value,'2000');
assert.equal(ids.year.options.at(-1).value,'2050');
for(const year of ['2000','2026','2050'])for(const kind of ['new','full','ingress']){
 ids.year.value=year;ids.kind.value=kind;ids.kind.events.change();assert.ok(ids.event.options.length>0);assert.match(ids.status.textContent,new RegExp(year));assert.equal(ids.save.disabled,false);
}
ids.year.value='2026';ids.kind.value='full';ids.kind.events.change();
ids.office.value='1';ids.office.events.change();assert.match(ids.status.textContent,/北海道/);
ids.aspects.checked=true;ids.aspects.events.change();ids.aspectDiagramPanel.open=true;ids.aspectDiagramPanel.events.toggle();
assert.equal(ids.saveDiagram.disabled,false);
ids.save.events.click();ids.saveDiagram.events.click();
if (apple) {
 assert.equal(downloads.length,0);
 assert.equal(shared.length,2);
 assert.ok(shared.every(file=>file.type==='image/png'&&file.name.endsWith('.png')));
 console.log('Mock iPad Web Share: both PNG files submitted');
 process.exit(0);
}
assert.equal(downloads.length,2);
assert.ok(downloads.every(name=>name.endsWith('.png')));
assert.equal(ids.pngPanel.hidden,false);
assert.match(ids.pngImage.src,/^data:image\/png;base64,/);
console.log('JS smoke: year boundaries, 3 event selectors, location, drawing paths, 2 save handlers');
