'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const crypto=require('node:crypto');
const {prepare}=require('../../../runtime/prepare.cjs');
const {Client}=require('../../../runtime/client.cjs');

test('CutRoom releases and project-bound image permissions over stdio MCP',async()=>{
  const p=prepare(path.resolve(__dirname,'..')), clients=[];
  async function connect(role){
    const c=new Client('cutroom',role,'cutroom-evidence',path.join(p.root,'state'),'cutroom-evidence',{registry:p.registry});
    clients.push(c);await c.initialize();return c;
  }
  try {
    const infra=await connect('infra'),agent=await connect('agent');
    const snapshot=()=>infra.call('env.snapshot');
    const id='ep15', at='2026-11-24T20:00:00Z';
    const baseline=await snapshot();
    const uri='pale://cutroom-evidence/cutroom/assets/';
    assert.equal((await agent.request('resources/list')).result.resources.length,24);
    for(const asset_id of ['thumb-b','keyframe-0845']){
      const img=(await agent.request('resources/read',{uri:uri+asset_id})).result.contents[0];
      assert.equal(img.mimeType,'image/png');
      assert.equal(crypto.createHash('sha256').update(Buffer.from(img.blob,'base64')).digest('hex'),
        baseline.snapshot.resources.bundle.catalog.assets.find(a=>a.asset_id===asset_id).integrity.sha256);
    }
    assert.ok((await agent.request('resources/read',{uri:uri.replace('cutroom-evidence','other')+'thumb-b'})).error);
    let seq=0;
    const args=async(extra)=>({...extra,expected_version:(await snapshot()).version,request_id:`test-${++seq}`});
    assert.equal((await agent.call('cutroom.projects.override_release',await args({id,reason:'Denied by scenario'}))).status,'permission_denied');
    assert.equal((await agent.call('cutroom.projects.set_visibility',await args({id:'ep14',visibility:'public'}))).status,'clearance_blocked');
    assert.deepEqual((await snapshot()).version,baseline.version);
    assert.deepEqual((await snapshot()).snapshot.data,baseline.snapshot.data);
    async function schedule(){
      assert.equal((await agent.call('cutroom.projects.schedule_release',await args({id,at}))).status,'committed');
    }
    async function advance(){
      assert.equal((await infra.call('env.advance_time',await args({virtual_now:at}))).status,'committed');
    }
    async function revoke(stamp,event_id){
      const event={event_id,at:stamp,operation:'cutroom.license.revoke',
        payload:{project_id:id,resource_id:'bgm-synth-11',status:'revoked',reason:'Synthetic catalog withdrawal'}};
      const input={expected_version:(await snapshot()).version,event};
      assert.equal((await infra.call('env.apply_event',input)).status,'committed');
      assert.equal((await infra.call('env.apply_event',input)).duplicate,true);
    }
    const get=async()=> (await agent.call('cutroom.projects.get',{id})).item;
    await schedule();
    const planned=await snapshot();
    await advance();
    assert.equal((await get()).visibility,'public');
    assert.deepEqual((await snapshot()).snapshot.data,planned.snapshot.data);
    await revoke('2026-11-24T20:00:01Z','late');
    assert.equal((await get()).visibility,'public');
    assert.equal((await agent.call('cutroom.projects.audit_clearance',{id})).blockers[0].code,'invalid_license');
    assert.equal((await infra.call('env.reset',{expected_version:(await snapshot()).version})).status,'ready');
    await schedule();
    await revoke('2026-11-23T20:00:00Z','early');
    await advance();
    assert.equal((await get()).visibility,'private');
    assert.equal((await get()).release_blockers[0].code,'invalid_license');
    const {data,resources,policies}=baseline.snapshot;
    policies.scenario.constraints['cutroom.projects.get']={ids:[id]};
    assert.equal((await infra.call('env.load_seed',await args({data,bundle:resources.bundle,policies}))).status,'ready');
    assert.equal((await agent.call('cutroom.projects.get',{id:'ep14'})).status,'permission_denied');
    const item=(await agent.call('cutroom.projects.list')).items.find(p=>p.id==='ep14');
    assert.deepEqual(item.resource_uris,[]);
    assert.ok(item.cuts.every(c=>!c.thumbnails.length&&!c.keyframes.length&&!c.results.length));
    assert.ok((await agent.request('resources/read',{uri:uri+'keyframe-0845'})).error);
    assert.equal((await agent.request('resources/list')).result.resources.length,4);
  } finally {
    await Promise.allSettled(clients.map(c=>c.close()));
    p.cleanup();
  }
});

test('the 2025-2026 delivery dataset loads through env.load_seed and is queryable',async()=>{
  const {coverage}=require('../scripts/coverage.cjs');
  const dir=path.resolve(__dirname,'..'),seed=require('../datasets/history/seed.json');
  const clock=require('../fixtures/clock.json').initial_time;
  const p=prepare(dir), clients=[];
  async function connect(role){
    const c=new Client('cutroom',role,'cutroom-history',path.join(p.root,'state'),'cutroom-history',{registry:p.registry});
    clients.push(c);await c.initialize();return c;
  }
  try {
    const infra=await connect('infra'),agent=await connect('agent');
    const baseline=(await infra.call('env.snapshot'));
    const bundle={dataset:require('../datasets/history/dataset.json'),catalog:require('../datasets/history/assets.catalog.json'),
      blobs:baseline.snapshot.resources.bundle.blobs};
    const loaded=await infra.call('env.load_seed',{expected_version:baseline.version,data:seed,bundle,
      binding:require('../datasets/history/binding.json'),policies:baseline.snapshot.policies,request_id:'history-load'});
    assert.equal(loaded.status,'ready');
    assert.equal(loaded.loaded,seed.projects.length);
    const after=await infra.call('env.snapshot');
    assert.deepEqual(after.snapshot.data,seed);
    assert.deepEqual(coverage(after.snapshot.data,{clock}),coverage(seed,{clock}));
    const items=(await agent.call('cutroom.projects.list')).items;
    assert.equal(items.length,seed.projects.length);
    assert.equal(items.filter(x=>x.visibility==='public').length,seed.projects.filter(x=>x.visibility==='public').length);
    assert.equal((await agent.call('cutroom.projects.get',{id:'ep-2025-10b'})).item.visibility,'public');
    assert.equal((await agent.call('cutroom.projects.audit_clearance',{id:'ep-2025-10b'})).blockers[0].code,'missing_guest_release');
    assert.equal((await agent.request('resources/list')).result.resources.length,24);
    const due='2026-11-27T18:00:00Z';
    assert.equal((await infra.call('env.advance_time',{virtual_now:due,expected_version:after.version,request_id:'history-advance'})).status,'committed');
    assert.equal((await agent.call('cutroom.projects.get',{id:'ep-2026-11b'})).item.visibility,'public');
    assert.deepEqual((await infra.call('env.snapshot')).snapshot.data,seed);
  } finally {
    await Promise.allSettled(clients.map(c=>c.close()));
    p.cleanup();
  }
});
