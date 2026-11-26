'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../plugin.cjs');
const initial = require('../fixtures/clock.json').initial_time;
const release = '2026-11-24T20:00:00Z';
function fixture() {
  const ctx = {virtual_now:initial,binding:require('../fixtures/binding.json'),run_id:'test'};
  let data=structuredClone(require('../fixtures/minimal.json'));
  return {
    ctx, snapshot:()=>structuredClone(data),
    call(op,args={}) {
      const out=app.handleTool(ctx,structuredClone(data),'cutroom.'+op,args);
      app.validateSeed(ctx,out.data);
      if(require('../tools.json').find(t=>t.name==='cutroom.'+op).read_only) assert.deepEqual(out.data,data);
      data=out.data;return out.result;
    },
    event(at,op,payload) {
      const out=app.applyEvent({...ctx,virtual_now:at},structuredClone(data),{at,operation:'cutroom.'+op,payload});
      app.validateSeed(ctx,out);data=out;ctx.virtual_now=at;
    },
  };
}
const revoke=(f,at)=>f.event(at,'license.revoke',{project_id:'ep15',resource_id:'bgm-synth-11',status:'revoked',reason:'License withdrawn'});
test('public release is blocked by both active-cut notes and the restricted track',()=>{
  const f=fixture(), before=f.snapshot();
  assert.deepEqual(f.call('projects.audit_clearance',{id:'ep14'}).blockers.map(b=>[b.code,b.target_id]),
    [['unresolved_note','benchmark'],['unresolved_note','screen'],['invalid_license','bgm-lofi-07']]);
  assert.throws(()=>f.call('projects.set_visibility',{id:'ep14',visibility:'public'}),{code:'clearance_blocked'});
  assert.deepEqual(f.snapshot(),before);
});
test('music search includes exact BPM and expiry boundaries; a swap fixes just the music blocker',()=>{
  const f=fixture();
  const search=max_bpm=>f.call('library.search',{kind:'bgm',mood:'upbeat',active:true,max_bpm,license_scope:'commercial_sponsored'}).items.map(t=>t.id);
  assert.deepEqual(search(115),['bgm-fast','bgm-synth-11','bgm-synth-12']);
  assert.deepEqual(search(114),['bgm-synth-11','bgm-synth-12']);
  assert.throws(()=>f.call('projects.schedule_release',{id:'ep15',at:'2026-11-25T00:00:01Z'}),{code:'clearance_blocked'});
  assert.equal(f.call('projects.schedule_release',{id:'ep15',at:'2026-11-25T00:00:00Z'}).item.schedule.at,'2026-11-25T00:00:00Z');
  const peer=f.call('projects.get',{id:'ep15'}).item;
  f.call('projects.assign_track',{id:'ep14',track_id:'bgm-synth-12'});
  assert.deepEqual(f.call('projects.get',{id:'ep15'}).item,peer);
  assert.deepEqual(f.call('projects.audit_clearance',{id:'ep14'}).blockers.map(b=>b.target_id),['benchmark','screen']);
});
test('release derives at the scheduled instant; a later revocation leaves it public',()=>{
  const f=fixture();
  f.call('projects.schedule_release',{id:'ep15',at:release});
  const before=f.snapshot();
  f.ctx.virtual_now=release;
  assert.equal(f.call('projects.get',{id:'ep15'}).item.published_at,release);
  assert.deepEqual(f.snapshot(),before);
  revoke(f,'2026-11-24T20:00:01Z');
  assert.equal(f.call('projects.get',{id:'ep15'}).item.visibility,'public');
  assert.equal(f.call('projects.audit_clearance',{id:'ep15'}).blockers[0].code,'invalid_license');
});
test('revocation before or exactly at release keeps it private and reports why',()=>{
  for(const at of ['2026-11-23T20:00:00Z',release]){
    const f=fixture();
    f.call('projects.schedule_release',{id:'ep15',at:release});
    revoke(f,at);f.ctx.virtual_now=release;
    const {item}=f.call('projects.get',{id:'ep15'});
    assert.equal(item.visibility,'private');
    assert.equal(item.release_blockers[0].code,'invalid_license');
  }
});
test('guest withdrawal and re-sign, independent overrides, and candidate ownership',()=>{
  const f=fixture(), before=f.snapshot();
  assert.throws(()=>f.call('projects.set_thumbnail',{id:'ep14',cut_id:'v2',asset_id:'thumb-b'}),{code:'not_found'});
  assert.deepEqual(f.snapshot(),before);
  const {item}=f.call('projects.set_thumbnail',{id:'ep14',cut_id:'v3',asset_id:'thumb-b'});
  assert.equal(item.cuts[1].active_thumbnail,'thumb-b');
  assert.deepEqual(item.cuts[0],before.projects[0].cuts[0]);
  assert.equal(item.visibility,'private');
  for(const status of ['withdrawn','signed']){
    f.event(initial,'license.revoke',{project_id:'ep14',resource_id:'guest-ep14',status,reason:'Guest decision'});
    assert.equal(f.call('projects.audit_clearance',{id:'ep14'}).blockers.some(b=>b.code==='missing_guest_release'),status==='withdrawn');
  }
  const override=f.call('projects.override_release',{id:'ep14',at:release,reason:'Internal simulated review'}).item.overrides[0];
  assert.deepEqual([override.actor,override.at,override.intended_transition.scheduled_at,override.blockers.length],
    ['person-editor',initial,release,3]);
  f.ctx.virtual_now=release;
  assert.equal(f.call('projects.get',{id:'ep14'}).item.visibility,'public');
});
