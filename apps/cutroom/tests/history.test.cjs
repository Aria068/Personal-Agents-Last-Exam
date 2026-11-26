'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const app=require('../plugin.cjs');
const {coverage}=require('../scripts/coverage.cjs');
const root=path.resolve(__dirname,'..');
const seed=require('../datasets/history/seed.json');
const binding=require('../datasets/history/binding.json');
const clock=require('../fixtures/clock.json').initial_time;
const call=(at,op,args={})=>app.handleTool({virtual_now:at,binding,run_id:'history'},structuredClone(seed),'cutroom.'+op,args).result;
const project=(at,id)=>call(at,'projects.get',{id}).item;

test('delivery dataset is a valid seed that covers every month of 2025-2026',()=>{
  app.validateSeed({binding},seed);
  const r=coverage(seed,{clock});
  assert.deepEqual(r.window,['2025-01-01','2026-12-31']);
  assert.equal(r.outside_window,0);assert.equal(r.invalid,0);
  assert.deepEqual(r.months_without_records,[]);
  assert.equal(r.earliest.slice(0,7),'2025-01');assert.equal(r.latest.slice(0,7),'2026-12');
  assert.ok(r.distinct_dates>=300,`distinct dates ${r.distinct_dates}`);
  const dataset=require('../datasets/history/dataset.json');
  assert.equal(dataset.expected_counts.records,seed.projects.length);
  assert.ok(dataset.sources.every(s=>s.kind==='synthetic'&&s.generation.seed===239));
});

test('committed coverage report matches the committed seed',()=>{
  const report=JSON.parse(fs.readFileSync(path.join(root,'evidence/coverage.json'),'utf8'));
  const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'datasets/history/seed.json'))).digest('hex');
  assert.equal(report.sha256,sha);
  const {input,sha256,...rest}=report;
  assert.deepEqual(rest,JSON.parse(JSON.stringify(coverage(seed,{clock}))));
});

test('no stored past fact is dated after the clock; only schedules and expiries point forward',()=>{
  const {events}=require('../scripts/coverage.cjs');
  const late=events(seed).filter(e=>Date.parse(e.at)>Date.parse(clock));
  assert.ok(late.length>0);
  assert.deepEqual([...new Set(late.map(e=>e.field))].sort(),['expires_at','schedule.at']);
});

test('every historical release was cleared at its own release time unless it carries an override',()=>{
  for(const p of seed.projects.filter(p=>p.published_at)){
    const check=call(p.published_at,'projects.audit_clearance',{id:p.id});
    if(p.overrides.length){
      assert.equal(check.cleared,false);
      const o=p.overrides[0];
      assert.equal(o.actor,seed.owner_person_id);assert.equal(o.at,p.published_at);
      assert.deepEqual(o.intended_transition,{visibility:'public',scheduled_at:null});
      assert.deepEqual(o.blockers,check.blockers);
    } else assert.equal(check.cleared,true,p.id);
  }
});

test('later revocations and withdrawals leave past releases public but add audit blockers',()=>{
  const music=project(clock,'ep-2025-08b');
  assert.equal(music.visibility,'public');
  assert.deepEqual(call(clock,'projects.audit_clearance',{id:'ep-2025-08b'}).blockers.map(b=>b.code),['invalid_license']);
  const guest=project(clock,'ep-2025-10b');
  assert.equal(guest.visibility,'public');
  assert.deepEqual(call(clock,'projects.audit_clearance',{id:'ep-2025-10b'}).blockers.map(b=>b.code),['missing_guest_release']);
  // Withdrawn then re-signed before release: cleared at release.
  const resign=seed.projects.find(p=>p.id==='ep-2025-06a');
  assert.deepEqual(resign.guest_releases[0].history.map(h=>h.status),['signed','withdrawn','signed']);
  assert.equal(call(resign.published_at,'projects.audit_clearance',{id:resign.id}).cleared,true);
  assert.equal(call('2025-06-09T00:00:00Z','projects.audit_clearance',{id:resign.id}).blockers.at(-1).code,'missing_guest_release');
});

test('planned releases become public on read at their instant without a write',()=>{
  for(const p of seed.projects.filter(p=>p.schedule)){
    assert.equal(project(clock,p.id).visibility,'private');
    const out=app.handleTool({virtual_now:p.schedule.at,binding,run_id:'history'},structuredClone(seed),'cutroom.projects.get',{id:p.id});
    assert.equal(out.result.item.visibility,'public');
    assert.equal(out.result.item.published_at,p.schedule.at);
    assert.deepEqual(out.data,seed);
  }
  assert.ok(seed.projects.some(p=>p.schedule&&p.schedule.at.startsWith('2026-12')));
});

test('music search respects license expiry across the window',()=>{
  const active=at=>call(at,'library.search',{kind:'bgm',active:true}).items.map(t=>t.id);
  assert.ok(active('2025-08-31T23:59:59Z').includes('bgm-h04'));
  assert.ok(!active('2025-09-01T00:00:00Z').includes('bgm-h04'));
  assert.ok(active('2025-09-18T15:59:59Z').includes('bgm-h06'));
  assert.ok(!active('2025-09-18T16:00:00Z').includes('bgm-h06'));
});
