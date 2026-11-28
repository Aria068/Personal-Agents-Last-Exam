'use strict';
// Maintainer build for the delivery evaluation dataset (2025-01-01 .. 2026-12-31).
// Deterministic: the same seed always writes byte-identical files. Run:
//   node apps/cutroom/scripts/build-history.cjs
// The shipped files are committed; neither tests nor the runtime need this step.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'datasets/history');
const write=(file,x)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,file),JSON.stringify(x,null,2)+'\n');};
const core=JSON.parse(fs.readFileSync(path.join(root,'fixtures/minimal.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'contribution/assets.catalog.json'),'utf8'));
const CLOCK=JSON.parse(fs.readFileSync(path.join(root,'fixtures/clock.json'),'utf8')).initial_time;
const SEED=239, DATASET_ID='cutroom-history';
let s=SEED; const rnd=()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const pick=a=>a[Math.floor(rnd()*a.length)];
const iso=(y,m,d,h=17,min=0)=>new Date(Date.UTC(y,m-1,d,h,min)).toISOString().replace('.000Z','Z');
const plus=(at,days,h)=>{const d=new Date(at);d.setUTCDate(d.getUTCDate()+days);if(h!==undefined)d.setUTCHours(h,0,0);return d.toISOString().replace('.000Z','Z');};
const before=(a,b)=>Date.parse(a)<Date.parse(b);
// Earliest clock the seed can be loaded at: its latest stored past fact.
const minimumClock=data=>require('../plugin.cjs').pastFacts(data).map(x=>x.at).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);

// Licensed music signed and expiring across the window. History entries record
// the signing ("active") and any revocation; expiry is inclusive at expires_at.
const historyTracks=[
 ['bgm-h01','Morning desk pads',84,'calm','non_commercial_only','2025-01-08',null,null],
 ['bgm-h02','Pocket groove',104,'upbeat','commercial_sponsored','2025-01-15','2025-12-31',null],
 ['bgm-h03','Glass tones',96,'calm','commercial_sponsored','2025-02-20',null,null],
 ['bgm-h04','Night drive pulse',118,'upbeat','commercial_sponsored','2025-03-12','2025-08-31',null],
 ['bgm-h05','Paper lanterns',78,'calm','non_commercial_only','2025-04-02',null,null],
 ['bgm-h06','Signal bloom',112,'upbeat','commercial_sponsored','2025-05-14',null,'2025-09-18'],
 ['bgm-h07','Workshop shuffle',100,'upbeat','commercial_sponsored','2025-08-27','2026-06-30',null],
 ['bgm-h08','Soft focus',88,'calm','commercial_sponsored','2025-12-03',null,null],
 ['bgm-h09','Bright transit',114,'upbeat','commercial_sponsored','2026-02-11','2026-12-31',null],
 ['bgm-h10','Late edit hum',90,'calm','commercial_sponsored','2026-06-17','2026-12-15',null],
];
const library=[...core.library.map(x=>structuredClone(x)),...historyTracks.map(([id,title,bpm,mood,license_scope,signed,expires,revoked])=>({
 id,title,bpm,mood,license_scope,expires_at:expires?`${expires}T23:59:59Z`:null,kind:'bgm',visual_tags:[],
 history:[{at:`${signed}T16:00:00Z`,status:'active',reason:'License signed with synthetic catalog.'},
  ...(revoked?[{at:`${revoked}T16:00:00Z`,status:'revoked',reason:'Catalog withdrew the track.'}]:[])]}))];
const track=id=>library.find(t=>t.id===id);
const cleared=(t,at,sponsored)=>{
 const signed=t.history.find(h=>h.status==='active');
 const revoked=t.history.find(h=>h.status==='revoked'&&!before(at,h.at));
 return (!signed||!before(at,signed.at))&&!revoked&&(!t.expires_at||!before(t.expires_at,at))&&(!sponsored||t.license_scope==='commercial_sponsored');
};

const subjects=['Mechanical keyboard teardown','Budget mic shootout','Home office cable cleanup','Travel tripod review','Phone gimbal basics',
 'Winter light on a budget','Monitor calibration','Sound panels on rentals','One-bag travel kit','SSD backup routine','Editing on a train',
 'Color matching two cameras','Studio desk tour','Field recorder test','USB-C hub roundup','Writing a video outline','Lens cleaning kit',
 'Night street b-roll','Editing laptop thermals','Studio plant care','Webcam vs camera','Scripting a sponsor read','Archive drive labels',
 'LED panel comparison','Audio interface setup','Shooting product close-ups','Rainy day timelapse','Teleprompter tryout','Cheap slider test',
 'Batch exporting shorts','Fixing echo in a room','Weekend gear clean','Interview lighting','Hard drive failure story','Desk mat review',
 'Packing for a shoot','Captions workflow','Thumbnail sketching','Colour LUT basics','Wireless mic test','Studio year in review',
 'Ultralight vlog kit','Camera strap roundup','Backup power for shoots','Quiet keyboard switches','Planning a series','Spring studio refresh',
 'Holiday gift guide for editors'];
const noteTexts=[['00:14','Trim the cold open.'],['01:52','Lower music under dialogue.'],['03:05','Replace the shaky b-roll.'],['04:40','Check the lower-third spelling.'],
 ['06:12','Add the product disclosure card.'],['07:30','Color mismatch between angles.'],['09:02','End card links are outdated.']];
const projects=[];
const coreIds=new Set(core.projects.map(p=>p.id));
let n=0;
for(let y=2025;y<=2026;y++) for(let m=1;m<=12;m++) for(const day of [5,19]){
 const subject=subjects[n++],slug=`${y}-${String(m).padStart(2,'0')}${day===5?'a':'b'}`,id=`ep-${slug}`;
 if(coreIds.has(id))throw new Error('ID clash');
 const kickoff=iso(y,m,day,17,0), release=plus(kickoff,8,18);
 const sponsored=rnd()<0.55, past=before(release,CLOCK);
 // Planned work: authored before the clock, released after it.
 const authored=past?kickoff:plus(CLOCK,-(3+Math.floor(rnd()*6)),17);
 const usable=library.filter(t=>t.kind==='bgm'&&!coreIds.has(t.id)&&t.id.startsWith('bgm-h')&&cleared(t,release,sponsored));
 const t=pick(usable.length?usable:[track('bgm-synth-12')]);
 const deck=[...noteTexts];
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const notes=deck.slice(0,2+Math.floor(rnd()*3)).map(([timecode,text],i)=>{
  const at=plus(authored,i%2,17+i);
  return {id:`n${i+1}`,timecode,text,at,resolved_at:past?plus(authored,2+i,20):plus(at,1,20)};
 });
 const cuts=[{id:'v1',notes:[],thumbnails:[],keyframes:[],active_thumbnail:null,results:[]}];
 if(rnd()<0.6){cuts[0].notes=notes.slice(0,1).map(x=>({...x,id:'v1-'+x.id,resolved_at:plus(x.at,1,18)}));cuts.push({id:'v2',notes,thumbnails:[],keyframes:[],active_thumbnail:null,results:[]});}
 else cuts[0].notes=notes;
 const guest=rnd()<0.35?[{id:`guest-${slug}`,history:[{at:plus(authored,-2,16),status:'signed',reason:'Signed at guest intake.'}]}]:[];
 const p={id,title:subject,description:`Synthetic ${sponsored?'sponsored ':''}episode project for the studio channel.`,sponsored,
  visibility:'private',published_at:null,schedule:null,release_blockers:[],track_id:t.id,active_cut:cuts.at(-1).id,cuts,guest_releases:guest,overrides:[]};
 if(past){p.visibility='public';p.published_at=release;}
 else if(Date.parse(release)<=Date.parse('2026-12-15T00:00:00Z')) p.schedule={at:release,override:false};
 else { // Draft still in review at the clock: one note is open.
  p.cuts.at(-1).notes.forEach((x,i)=>{x.resolved_at=i===0?null:plus(x.at,1,20);});
 }
 projects.push(p);
}
// Curated history that exercises the approved release semantics on past data.
const byId=id=>projects.find(p=>p.id===id);
{ // Guest withdrew, then re-signed before release (status values: signed / withdrawn).
 const p=byId('ep-2025-06a');p.guest_releases=[{id:'guest-2025-06a',history:[
  {at:'2025-06-02T16:00:00Z',status:'signed',reason:'Signed at guest intake.'},
  {at:'2025-06-08T19:30:00Z',status:'withdrawn',reason:'Guest asked to blur a whiteboard.'},
  {at:'2025-06-11T18:00:00Z',status:'signed',reason:'Re-signed after the blur was added.'}]}];
}
{ // Guest withdrew after release: the release stays public; a current audit shows the blocker.
 const p=byId('ep-2025-10b');p.guest_releases=[{id:'guest-2025-10b',history:[
  {at:'2025-10-17T16:00:00Z',status:'signed',reason:'Signed at guest intake.'},
  {at:'2025-11-03T21:00:00Z',status:'withdrawn',reason:'Guest changed employers and withdrew consent.'}]}];
}
{ // Music revoked after release; the release predates the revocation and stays public.
 const p=byId('ep-2025-08b');p.sponsored=true;p.description='Synthetic sponsored episode project for the studio channel.';p.track_id='bgm-h06';
}
{ // Explicit override with recorded actor, time, intended transition and blockers.
 const p=byId('ep-2025-11a'),c=p.cuts.at(-1);c.notes[0].resolved_at=plus(p.published_at,3,20);
 p.overrides=[{actor:core.owner_person_id,at:p.published_at,reason:'Time-sensitive launch; caption fix shipped after release.',
  intended_transition:{visibility:'public',scheduled_at:null},
  blockers:[{code:'unresolved_note',target_id:c.notes[0].id,message:`${c.notes[0].timecode} ${c.notes[0].text}`}]}];
}
{ // Unlisted preview shared with a sponsor; never public.
 const p=byId('ep-2026-04b');p.visibility='unlisted';p.published_at=null;
}
const seed={account_id:core.account_id,owner_person_id:core.owner_person_id,timezone:core.timezone,
 projects:[...projects,...core.projects.map(p=>structuredClone(p))],library};
const source={source_id:'synthetic',kind:'synthetic',
 description:'Procedurally generated studio history (2025-01..2026-12) plus the authored CutRoom evaluation fixtures. No real people, channels or external records.',
 uri:null,license:'MIT',usage:'permitted',collection:null,
 generation:{method:'procedural',tool:'apps/cutroom/scripts/build-history.cjs',tool_version:'1.0.0',seed:SEED,
  parameters:{window_start:'2025-01-01',window_end:'2026-12-31',timezone:core.timezone,clock:CLOCK,cadence:'two episodes per month (5th and 19th)',
   load_clock:{default_virtual_now:CLOCK,minimum_virtual_now:minimumClock(seed),
    rule:'env.load_seed rejects (invalid_seed) a virtual_now earlier than any stored past fact (published_at, note at/resolved_at, A/B result at, guest and license history, override at). Schedules and license expiries are plans and may point forward.'}}}};
const dataset={schema_version:'pale.dataset.v1',dataset_id:DATASET_ID,version:'1.0.0',
 description:'CutRoom delivery evaluation dataset covering 2025-01-01 through 2026-12-31. Fully synthetic; see evidence/coverage.md.',
 record_source_ids:['synthetic'],sources:[source],transformations:[],
 expected_counts:{records:seed.projects.length,assets:catalog.assets.length},
 quality_policy:{duplicate_records:'reject',duplicate_assets:'reject',missing_assets:'reject'},
 review:{status:'pending',reviewer:null,notes:'Independent human review of realism and provenance pending.'}};
const historyCatalog={...catalog,catalog_id:'cutroom-history-assets',
 assets:catalog.assets.map(a=>({...a,provenance:{...a.provenance,dataset_id:DATASET_ID}}))};
write('seed.json',seed);
write('dataset.json',dataset);
write('assets.catalog.json',historyCatalog);
write('binding.json',{people:[{person_id:core.owner_person_id,name:'Quinn Vale'}],
 accounts:[{app_id:'cutroom',account_id:core.account_id,owner_person_id:core.owner_person_id}],objects:{cutroom:seed.projects.map(p=>p.id)}});
console.log(`wrote ${seed.projects.length} projects and ${library.length} library items to ${path.relative(process.cwd(),out)}`);
