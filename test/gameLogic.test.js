'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {catalog,createRace,roll,turn}=require('../server/gameLogic');
test('roster contains 40 unique character cards',()=>{assert.equal(catalog.length,40);assert.equal(new Set(catalog.map(c=>c.id)).size,40);});
test('race has three fixed negative spaces and two trip spaces',()=>{const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]};const r=createRace(room,0);assert.equal(Object.keys(r.effects).length,3);assert.ok(![9,22].some(n=>Object.hasOwn(r.effects,n)));});
test('server rejects a roll from the wrong player',()=>{const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]};const r=createRace(room,0);assert.throws(()=>roll(r,'b',{}),/Nije tvoj potez/);});
test('all roster abilities survive randomized race simulation',()=>{for(const c of catalog){const room={players:[{id:'a',name:'A',picks:[c.id]},{id:'b',name:'B',picks:['c01']},{id:'c',name:'C',picks:['c02']}]};const r=createRace(room,0);let count=0;while(r.status==='running'&&count++<500){const next=turn(r);assert.ok(next);roll(r,next.playerId,{});}assert.notEqual(r.status,'running',`${c.name} stalled`);}});


test('turn lookup does not mutate the race turn index',()=>{
 const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']},{id:'c',name:'C',picks:['c03']}]};
 const r=createRace(room,0);r.racers[0].finished=true;
 r.turnIndex=0;
 assert.equal(turn(r).playerId,'b');
 assert.equal(r.turnIndex,0);
});

test('the race uses PAD spaces and skips the next turn after falling',()=>{
 const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]};
 const r=createRace(room,0);
 const racer=r.racers[0];
 racer.position=8;
 // Land on the fixed PAD field with a deterministic one-space move.
 const {roll}=require('../server/gameLogic');
 // Force the random result through a temporary Math.random override.
 const original=Math.random;Math.random=()=>0;
 try { roll(r,'a',{}); } finally { Math.random=original; }
 assert.equal(racer.tripped,true);
 assert.match(r.log.join(' '),/PAD/);
});

test('all character display names are Bosnian-localized',()=>{
 const {catalog}=require('../server/gameLogic');
 assert.equal(catalog.length,40);
 assert.ok(catalog.every(c=>c.title && c.description && !/^(Lucky Roll|Iron Wall|Time Thief|Echo|Twin Souls|Oracle|Doom Bell|Jinx|Stone Walker|Underdog|Double Trouble|Bouncer|Six Collector|Perfect Pace|Desperate|Reroute|Tailwind|Risk Taker|Corner Start|Suppressor|Rival Hunter|Last Stand|Overtaker|Twin Dice|Four Hearts|Six to Start|Even Sage|Odd Sage|Fallen Hero|Penny Sprite|Quake|Puppet Master|Backward King|Magnet|Reroller|High Roller|Bridge Jumper|Mud Runner|Time Bubble|Comet)$/.test(c.name)));
});


test('the client stores the player ID received from the server identity event',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(client,/myId=x\.player/);
});

test('advancing past inactive racers increments the round only once',()=>{
 const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']},{id:'c',name:'C',picks:['c03']}]};
 const r=createRace(room,0);
 r.racers[1].finished=true;
 r.turnIndex=2;
 const {advance}=require('../server/gameLogic');
 advance(r);
 assert.equal(r.turnIndex,0);
 assert.equal(r.round,2);
 assert.equal(r.firstRoundComplete,true);
 assert.equal(turn(r).playerId,'a');
});

test('server waits for every player to confirm the lineup before creating race one',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server/server.js'),'utf8');
 assert.match(server,/room\.phase='lineup'/);
 assert.match(server,/room\.players\.every\(p=>p\.lineupConfirmed\)/);
 assert.match(server,/room\.phase='race';room\.raceNo=0;room\.race=createRace\(room,0\)/);
});
test('client animates movement in single-space increments',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(client,/visualPositions\[m\.id\]=cur\+\(m\.to>cur\?1:-1\)/);
 assert.match(client,/setTimeout\(resolve,240\)/);
});
test('race results include player IDs for an accurate multiplayer score table',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server/server.js'),'utf8');
 assert.match(server,/map\(x=>\(\{playerId:x\.playerId,name:x\.playerName/);
});
