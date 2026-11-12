'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {catalog,createRace,roll,turn}=require('../server/gameLogic');
test('roster contains 41 unique character cards',()=>{assert.equal(catalog.length,41);assert.equal(new Set(catalog.map(c=>c.id)).size,41);});
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
 assert.equal(catalog.length,41);
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


test('Corner Start begins on field 10',()=>{
 const room={players:[{id:'a',name:'A',picks:['c19']},{id:'b',name:'B',picks:['c01']}]};
 const r=createRace(room,0);
 assert.equal(r.racers[0].position,10);
});
test('finish fields are exclusive and second place cannot occupy first place',()=>{
 const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']},{id:'c',name:'C',picks:['c03']}]};
 const r=createRace(room,0);
 const {roll}=require('../server/gameLogic');
 r.racers[0].position=29;r.racers[1].position=30;
 // Deterministic six: first racer wins at 32.
 const original=Math.random;Math.random=()=>0.999999;
 try{roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].position,32);
 assert.equal(r.racers[0].finishPlace,1);
 // Second racer now reaches/overshoots 32 but must be assigned field 31.
 const original2=Math.random;Math.random=()=>0.999999;
 try{roll(r,'b',{});}finally{Math.random=original2;}
 assert.equal(r.racers[1].position,31);
 assert.equal(r.racers[1].finishPlace,2);
 assert.equal(r.status,'finished');
});
test('disconnected players are skipped instead of blocking the turn queue',()=>{
 const room={players:[{id:'a',name:'A',picks:['c01'],connected:false},{id:'b',name:'B',picks:['c02']},{id:'c',name:'C',picks:['c03']}]};
 const r=createRace(room,0);
 assert.equal(turn(r).playerId,'b');
 const {advance}=require('../server/gameLogic');
 advance(r);
 assert.equal(turn(r).playerId,'b');
 advance(r);
 assert.equal(turn(r).playerId,'c');
});
test('two-dice ability stores both visible dice results',()=>{
 const room={players:[{id:'a',name:'A',picks:['c24']},{id:'b',name:'B',picks:['c01']}]};
 const r=createRace(room,0);r.firstRoundComplete=true;
 const original=Math.random;let n=0;Math.random=()=>{n++;return n===1?0.1:0.8;};
 try{roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].lastNatural,1);
 assert.equal(r.racers[0].lastSecond,5);
});


test('race remains resumable if every active racer temporarily disconnects',()=>{
 const room={players:[{id:'a',name:'A',picks:['c01'],connected:false},{id:'b',name:'B',picks:['c02'],connected:false}]};
 const r=createRace(room,0);
 const {advance}=require('../server/gameLogic');
 advance(r);
 assert.equal(r.status,'running');
 r.racers[1].connected=true;
 assert.equal(turn(r).playerId,'b');
});


test('Gvozdeni zid eliminates a rival when its owner lands on them',()=>{
 const room={players:[{id:'a',name:'A',picks:['c02']},{id:'b',name:'B',picks:['c01']}]};
 const r=createRace(room,0);r.effects={};r.firstRoundComplete=true;r.racers[0].position=4;r.racers[1].position=5;
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[1].eliminated,true);
});

test('Četiri života loses a life only when another racer lands on its field',()=>{
 const room={players:[{id:'a',name:'A',picks:['c06']},{id:'b',name:'B',picks:['c25']}]};
 const r=createRace(room,0);r.effects={};r.firstRoundComplete=true;r.racers[0].position=4;r.racers[1].position=5;
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[1].lives,3);
 assert.equal(r.racers[1].position,6);
 const r2=createRace({players:[{id:'a',name:'A',picks:['c25']},{id:'b',name:'B',picks:['c01']}]},0);
 r2.firstRoundComplete=true;r2.racers[0].position=4;r2.racers[1].position=5;
 const original2=Math.random;Math.random=()=>0;
 try{roll(r2,'a',{});}finally{Math.random=original2;}
 assert.equal(r2.racers[0].lives,4);
});

test('Autsaider can earn at most two bonus points per race',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c10']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.racers[1].eliminated=true;
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{});r.turnIndex=0;roll(r,'a',{});r.turnIndex=0;roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].bonusPointCount,2);
 assert.equal(r.racers[0].points,2);
});

test('Gospodar lutaka can use the ability repeatedly and falls back to movement without a target',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c32']},{id:'b',name:'B',picks:['c01']}]},0);
 r.effects={};r.firstRoundComplete=true;r.racers[0].position=10;r.racers[1].position=12;
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{target:'b'});r.turnIndex=0;roll(r,'a',{target:'b'});}finally{Math.random=original;}
 assert.equal(r.racers[1].position,10);
 assert.equal(r.racers[0].position,10);
 r.turnIndex=0;
 try{Math.random=()=>0;roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].position,11);
});

test('Trgovac koracima spends one coin to choose movement from one to eight',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c39']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.racers[0].coins=1;r.effects={};
 roll(r,'a',{paidMove:true,move:8});
 assert.equal(r.racers[0].position,8);
 assert.equal(r.racers[0].coins,0);
});

test('Dvostruka nevolja is limited to two uses, not one',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c11']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{double:true});r.turnIndex=0;roll(r,'a',{double:true});r.turnIndex=0;roll(r,'a',{double:true});}finally{Math.random=original;}
 assert.equal(r.racers[0].used.double,2);
});

test('Preusmjerivač permanently receives plus one movement after activation',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c16']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.effects={};
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{});r.turnIndex=0;roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].used.reroute,true);
 assert.equal(r.racers[0].position,4);
});


test('Eho gains two spaces whenever an opponent uses an extra turn',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c06']},{id:'b',name:'B',picks:['c04']}]},0);
 r.firstRoundComplete=true;
 const original=Math.random;Math.random=()=>0;
 try{roll(r,'a',{predict:1});roll(r,'a',{predict:1});}finally{Math.random=original;}
 assert.equal(r.racers[1].position,2);
});

test('Preticač earns no more than three bonus points across the whole race',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c23']},{id:'b',name:'B',picks:['c01']},{id:'c',name:'C',picks:['c06']}]},0);
 r.firstRoundComplete=true;r.effects={};
 r.racers[0].position=0;r.racers[1].position=1;r.racers[2].position=2;
 const original=Math.random;Math.random=()=>0.999999;
 try{roll(r,'a',{});r.turnIndex=0;r.racers[0].position=0;r.racers[1].position=1;r.racers[2].position=2;roll(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].overtakePoints,3);
 assert.equal(r.racers[0].points,3);
});


test('rooms support voluntary exit and host-controlled removal',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server/server.js'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(server,/s\.on\('leaveRoom'/);
 assert.match(server,/s\.on\('kickPlayer'/);
 assert.match(server,/player\.id!==room\.hostId/);
 assert.match(client,/leaveRoomBtn/);
 assert.match(client,/roomKicked/);
});

test('race roster cards open a modal with each racer ability description',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(client,/data-ability=/);
 assert.match(client,/function showRacerAbility/);
 assert.match(client,/c\.description/);
});
