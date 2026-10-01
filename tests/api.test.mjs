import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.DESK_TEST_URL||'http://127.0.0.1:8787';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Run integration tests only against a local demo.');
const owner=`qa-${Date.now()}`;
const get=async(id=owner)=>(await fetch(base+'/api/desk',{headers:{'oai-authenticated-user-id':id}})).json();
const post=(revision,action,extra={})=>fetch(base+'/api/desk',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':owner,Origin:base,...extra},body:JSON.stringify({revision,action})});
test('API persistence, isolation, concurrency and stale approval',async()=>{
 const fresh=await get();assert.equal(fresh.cash,10000000);
 const requests=await Promise.all([post(0,{type:'approve',symbol:'RELIANCE'}),post(0,{type:'approve',symbol:'RELIANCE'})]);
 assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);
 let saved=await get();assert.equal(saved.positions.length,1);assert.equal(saved.version,1);
 const other=await get(owner+'-other');assert.equal(other.positions.length,0);
 assert.equal((await post(0,{type:'approve',symbol:'LT'})).status,409);
 assert.equal((await post(saved.version,{type:'approve',symbol:'RELIANCE'})).status,400);
 assert.equal((await post(saved.version,{type:'advance'},{Origin:'https://untrusted.example'})).status,403);
 const moved=await post(saved.version,{type:'advance'});assert.equal(moved.status,200);saved=await moved.json();assert.equal(saved.step,5);
 assert.equal((await post(1,{type:'approve',symbol:'LT'})).status,409);
 if(saved.positions.length){const response=await post(saved.version,{type:'close',id:saved.positions[0].id});assert.equal(response.status,200);saved=await response.json();}
 const reloaded=await get();assert.equal(reloaded.positions.length,0);assert.equal(reloaded.trades.length,1);assert.equal(reloaded.cash,10000000+reloaded.trades[0].net);
 assert.equal((await post(reloaded.version,{type:'settings',settings:{risk:100000,maxPositions:9,reward:10}})).status,400);
 assert.equal((await get()).version,reloaded.version);
});
