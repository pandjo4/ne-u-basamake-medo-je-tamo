'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {catalog,createRace,roll,turn,activateAbility,rank}=require('../server/gameLogic');
function xPending(x,choice={}){x.pendingSecondChance={dice:[4],choice};}
function takeTurn(r,id,choice={}){const x=r.racers.find(y=>y.playerId===id);if(x?.character.ability==='sixStart'){if(!x.used.leftStart&&x.position===0){x.pendingSecondChance={dice:[6],choice:{}};roll(r,id,{secondChance:false});}else roll(r,id,{move:3});return;}roll(r,id,choice);if(x?.pendingSecondChance)roll(r,id,{secondChance:false});}
test('roster contains 39 unique playable character cards after removing the two excluded characters',()=>{assert.equal(catalog.length,39);assert.equal(new Set(catalog.map(c=>c.id)).size,39);});
test('race has three fixed negative spaces and two trip spaces',()=>{const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]};const r=createRace(room,0);assert.equal(Object.keys(r.effects).length,3);assert.ok(![9,22].some(n=>Object.hasOwn(r.effects,n)));});
test('server rejects a roll from the wrong player',()=>{const room={players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]};const r=createRace(room,0);assert.throws(()=>roll(r,'b',{}),/Nije tvoj potez/);});
test('all roster abilities survive randomized race simulation',()=>{for(const c of catalog){const room={players:[{id:'a',name:'A',picks:[c.id]},{id:'b',name:'B',picks:['c01']},{id:'c',name:'C',picks:['c02']}]};const r=createRace(room,0);let count=0;while(r.status==='running'&&count++<500){const next=turn(r);assert.ok(next);takeTurn(r,next.playerId,{});}assert.notEqual(r.status,'running',`${c.name} stalled`);}});


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
 try { takeTurn(r,'a',{}); } finally { Math.random=original; }
 assert.equal(racer.tripped,true);
 assert.match(r.log.join(' '),/PAD/);
});

test('all character display names are Bosnian-localized',()=>{
 const {catalog}=require('../server/gameLogic');
 assert.equal(catalog.length,39);
 assert.ok(catalog.every(c=>c.title===c.name && c.description && c.image.startsWith('/pictures/')));
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
 try{takeTurn(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].position,32);
 assert.equal(r.racers[0].finishPlace,1);
 // Second racer now reaches/overshoots 32 but must be assigned field 31.
 const original2=Math.random;Math.random=()=>0.999999;
 try{takeTurn(r,'b',{});}finally{Math.random=original2;}
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
 try{takeTurn(r,'a',{});}finally{Math.random=original;}
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
 try{takeTurn(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[1].eliminated,true);
});

test('Četiri života loses a life only when another racer lands on its field',()=>{
 const room={players:[{id:'a',name:'A',picks:['c06']},{id:'b',name:'B',picks:['c25']}]};
 const r=createRace(room,0);r.effects={};r.firstRoundComplete=true;r.racers[0].position=4;r.racers[1].position=5;
 const original=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{});}finally{Math.random=original;}
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
 try{takeTurn(r,'a',{});r.turnIndex=0;takeTurn(r,'a',{});r.turnIndex=0;takeTurn(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].bonusPointCount,2);
 assert.equal(r.racers[0].points,2);
});

test('Gospodar lutaka can use the ability repeatedly and falls back to movement without a target',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c32']},{id:'b',name:'B',picks:['c01']}]},0);
 r.effects={};r.firstRoundComplete=true;r.racers[0].position=10;r.racers[1].position=12;
 const original=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{target:'b'});r.turnIndex=0;takeTurn(r,'a',{target:'b'});}finally{Math.random=original;}
 assert.equal(r.racers[1].position,10);
 assert.equal(r.racers[0].position,10);
 r.turnIndex=0;
 try{Math.random=()=>0;takeTurn(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].position,11);
});

test('Trgovac koracima spends one coin to choose movement from one to eight',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c39']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.racers[0].coins=1;r.effects={};
 takeTurn(r,'a',{paidMove:true,move:8});
 assert.equal(r.racers[0].position,8);
 assert.equal(r.racers[0].coins,0);
});

test('Dvostruka nevolja is limited to two uses, not one',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c11']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;
 const original=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{double:true});r.turnIndex=0;takeTurn(r,'a',{double:true});r.turnIndex=0;takeTurn(r,'a',{double:true});}finally{Math.random=original;}
 assert.equal(r.racers[0].used.double,2);
});

test('Preusmjerivač permanently receives plus one movement after activation',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c16']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.effects={};
 const original=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{});r.turnIndex=0;takeTurn(r,'a',{});}finally{Math.random=original;}
 assert.equal(r.racers[0].used.reroute,true);
 assert.equal(r.racers[0].position,4);
});


test('Eho gains two spaces whenever an opponent uses an extra turn',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c06']},{id:'b',name:'B',picks:['c04']}]},0);
 r.firstRoundComplete=true;
 const original=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{predict:1});takeTurn(r,'a',{predict:1});}finally{Math.random=original;}
 assert.equal(r.racers[1].position,2);
});

test('Preticač earns no more than three bonus points across the whole race',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c23']},{id:'b',name:'B',picks:['c01']},{id:'c',name:'C',picks:['c06']}]},0);
 r.firstRoundComplete=true;r.effects={};
 r.racers[0].position=0;r.racers[1].position=1;r.racers[2].position=2;
 const original=Math.random;Math.random=()=>0.999999;
 try{takeTurn(r,'a',{});r.turnIndex=0;r.racers[0].position=0;r.racers[1].position=1;r.racers[2].position=2;takeTurn(r,'a',{});}finally{Math.random=original;}
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


test('removed roster entries stay absent and surviving character IDs remain stable',()=>{
 assert.equal(catalog.length,39);
 assert.ok(!catalog.some(c=>c.ability==='suppression'||c.ability==='jump'));
 assert.equal(catalog.find(c=>c.image==='/pictures/sifiz.png').id,'c13');
 assert.equal(catalog.find(c=>c.image==='/pictures/maja.png').id,'c29');
});

test('Pali heroj receives +1 to each die roll and ignores PAD',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c29']},{id:'b',name:'B',picks:['c01']}]},0);
 r.racers[0].position=8;r.effects={};
 const old=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 assert.equal(r.racers[0].lastNatural,2);
 assert.equal(r.racers[0].position,10);
 assert.equal(r.racers[0].tripped,false);
});

test('Štedljivac starts with one coin and earns one on PAD and negative tiles',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c40']},{id:'b',name:'B',picks:['c01']}]},0);
 const x=r.racers[0];assert.equal(x.coins,1);
 r.effects={};x.position=8;
 const old=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 assert.equal(x.position,9);assert.equal(x.tripped,true);
 assert.equal(x.coins,3); // +1 normal turn income, +1 landing reward
});

test('Zvono propasti does not weaken its own owner',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c07']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;
 const old=Math.random;Math.random=()=>0.5;
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 assert.equal(r.racers[0].lastMove,4);
});

test('SKOK is once per race, moves two spaces and resolves the destination tile',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 r.effects={11:-1};r.racers[0].position=9;
 activateAbility(r,'a','jump');
 assert.equal(r.racers[0].position,10); // 9 + 2 lands on 11, then -1
 assert.equal(r.racers[0].abilitiesUsed.jump,true);
 r.turnIndex=0;assert.throws(()=>activateAbility(r,'a','jump'),/već si iskoristio/);
});

test('NAMJEŠTANJE excludes the selected die face and is single-use',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 activateAbility(r,'a','rig',3);
 const old=Math.random;Math.random=()=>0.4; // index 2 of the five permitted faces => 4
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 assert.notEqual(r.racers[0].lastNatural,3);
 assert.equal(r.racers[0].abilitiesUsed.rig,true);
 r.turnIndex=0;assert.throws(()=>activateAbility(r,'a','rig',3),/već si iskoristio/);
});

test('DUPLIKAT repeats the previous final die result exactly',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 const old=Math.random;Math.random=()=>0.5;
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 const previous=r.racers[0].lastNatural;
 r.turnIndex=0;
 activateAbility(r,'a','duplicate');
 takeTurn(r,'a',{});
 assert.equal(r.racers[0].lastNatural,previous);
 assert.equal(r.racers[0].abilitiesUsed.duplicate,true);
});


test('race ranking compares forward and reverse racers using actual progress',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c33']},{id:'c',name:'C',picks:['c02']}]},0);
 r.racers[0].position=8; // 8 spaces forward
 r.racers[1].position=20; // 12 spaces toward START
 r.racers[2].position=5;
 assert.deepEqual(rank(r).map(x=>x.playerId),['b','a','c']);
});


test('a pending die-control ability cannot be stacked with another power',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 activateAbility(r,'a','rig',4);
 assert.throws(()=>activateAbility(r,'a','jump'),/Prvo baci kockicu/);
});

test('NAMJEŠTANJE also blocks the selected final result for Pali heroj',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c29']},{id:'b',name:'B',picks:['c01']}]},0);
 activateAbility(r,'a','rig',3);
 const old=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 assert.notEqual(r.racers[0].lastNatural,3);
});

test('clickable board roster cards are not blocked by the board overlay',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../public/style.css'),'utf8');
 assert.match(client,/document\.querySelectorAll\('\[data-ability\]'\)/);
 assert.match(css,/\.board-center \.center-roster\{pointer-events:auto\}/);
});


test('Štedljivac earns the bonus coin when landing on a negative field',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c40']},{id:'b',name:'B',picks:['c01']}]},0);
 const x=r.racers[0];x.position=9;r.effects={10:-1};
 const old=Math.random;Math.random=()=>0;
 try{takeTurn(r,'a',{});}finally{Math.random=old;}
 assert.equal(x.position,9); // lands on 10, then the -1 effect returns him to 9
 assert.equal(x.coins,3); // starting coin + turn income + field reward
});


test('ŠTEDIŠA skips the roll, grants exactly one coin and advances the turn',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 const x=r.racers[0];x.position=7;x.coins=3;
 activateAbility(r,'a','thrifty');
 assert.equal(x.position,7);assert.equal(x.coins,4);assert.equal(x.abilitiesUsed.thrifty,true);
 assert.equal(turn(r).playerId,'b');assert.match(r.log[0],/ŠTEDIŠU/);
 assert.throws(()=>activateAbility(r,'a','thrifty'),/Nije tvoj potez/);
});
test('ŠTEDIŠA cannot be activated after the player has rolled in the current turn',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 roll(r,'a',{});
 assert.ok(r.racers[0].pendingSecondChance);
 assert.throws(()=>activateAbility(r,'a','thrifty'),/prije bacanja/);
});
test('RESET awards coins by current track position, returns to START and does not trigger START effects',()=>{
 for(const [position,reward] of [[8,0],[15,1],[25,2]]){
  const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
  const x=r.racers[0];x.position=position;r.effects[0]=-2;
  activateAbility(r,'a','reset');
  assert.equal(x.position,0);assert.equal(x.coins,reward);assert.equal(x.abilitiesUsed.reset,true);
  assert.equal(r.log.some(v=>/negativno polje/.test(v)),false);
  assert.equal(turn(r).playerId,'b');
 }
});
test('RESET is unavailable on START and cannot be used after rolling',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 assert.throws(()=>activateAbility(r,'a','reset'),/START/);
 r.racers[0].position=12;roll(r,'a',{});
 assert.throws(()=>activateAbility(r,'a','reset'),/prije bacanja/);
});
test('DRUGA ŠANSA holds the first server die without moving or applying effects, then uses the replacement die',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 const x=r.racers[0],old=Math.random;let n=0;r.effects={};
 Math.random=()=>{n++;return n===1?0:0.999999;};
 try{
  roll(r,'a',{});
  assert.deepEqual(x.pendingSecondChance.dice,[1]);
  assert.equal(x.position,0);assert.equal(x.coins,0);assert.equal(x.lastNatural,null);
  assert.equal(x.abilitiesUsed.secondChance,false);
  assert.throws(()=>roll(r,'a',{}),/Odaberi DA ili NE/);
  roll(r,'a',{secondChance:true});
 }finally{Math.random=old;}
 assert.equal(x.position,6);assert.equal(x.coins,1);assert.equal(x.lastNatural,6);
 assert.equal(x.abilitiesUsed.secondChance,true);assert.equal(x.pendingSecondChance,null);
 assert.equal(turn(r).playerId,'b');
});
test('declining DRUGA ŠANSA finalizes the original die and leaves the ability available',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 const x=r.racers[0];r.effects={};x.pendingSecondChance={dice:[1],choice:{}};
 roll(r,'a',{secondChance:false});
 assert.equal(x.position,1);assert.equal(x.coins,1);assert.equal(x.abilitiesUsed.secondChance,false);
});
test('new universal abilities are independent for each racer and cannot be double-activated',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 const a=r.racers[0],b=r.racers[1];a.position=11;b.position=22;
 activateAbility(r,'a','thrifty');
 assert.equal(a.abilitiesUsed.thrifty,true);assert.equal(b.abilitiesUsed.thrifty,false);
 activateAbility(r,'b','reset');
 assert.equal(b.abilitiesUsed.reset,true);assert.equal(a.abilitiesUsed.reset,false);
 assert.equal(b.coins,2);
});
test('server resolves a pending Second Chance with the first result before a disconnect advances the turn',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server/server.js'),'utf8');
 assert.match(server,/pendingSecondChance\)\s*\{try\{roll\(z\.room\.race,z\.player\.id,\{secondChance:false\}\)/);
 assert.match(server,/if\(pending\)\{try\{roll\(room\.race,playerId,\{secondChance:false\}\)/);
});

test('RESET returns reverse-direction characters to their own START and uses forward race progress for reward',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c33']},{id:'b',name:'B',picks:['c01']}]},0);
 const x=r.racers[0];assert.equal(x.startPosition,32);x.position=20;
 activateAbility(r,'a','reset');
 assert.equal(x.position,32);assert.equal(x.coins,1);
});

test('DRUGA ŠANSA rerolls both dice for a two-dice character before any movement occurs',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c24']},{id:'b',name:'B',picks:['c01']}]},0);
 const x=r.racers[0],old=Math.random;let n=0;r.effects={};r.firstRoundComplete=true;
 Math.random=()=>{n++;return [0.1,0.8,0.3,0.999999][n-1]??0.5;};
 try{
  roll(r,'a',{});
  assert.deepEqual(x.pendingSecondChance.dice,[1,5]);
  assert.equal(x.position,0);
  roll(r,'a',{secondChance:true});
 }finally{Math.random=old;}
 assert.equal(x.lastNatural,2);assert.equal(x.lastSecond,6);
 assert.equal(x.position,2);assert.equal(x.abilitiesUsed.secondChance,true);
});
test('DRUGA ŠANSA can replace a pending DUPLIKAT result without breaking its server-side validation',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c01']},{id:'b',name:'B',picks:['c02']}]},0);
 const x=r.racers[0],old=Math.random;r.effects={};x.lastNatural=4;
 activateAbility(r,'a','duplicate');
 Math.random=()=>0.999999;
 try{
  roll(r,'a',{});
  assert.deepEqual(x.pendingSecondChance.dice,[4]);
  roll(r,'a',{secondChance:true});
 }finally{Math.random=old;}
 assert.equal(x.lastNatural,6);assert.equal(x.position,6);
 assert.equal(x.abilitiesUsed.duplicate,true);assert.equal(x.abilitiesUsed.secondChance,true);
});

test('race UI renders all six universal ability cards and DA/NE decision controls',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 for(const label of ['SKOK','NAMJEŠTANJE','DUPLIKAT','ŠTEDIŠA','RESET','DRUGA ŠANSA'])assert.ok(client.includes(label),`missing ${label}`);
 assert.match(client,/data-second-chance="yes"/);assert.match(client,/data-second-chance="no"/);
});


test('Vozzz cannot leave START without a six on the very first round',()=>{
 const room={players:[{id:'a',name:'A',picks:['c26']},{id:'b',name:'B',picks:['c01']}]};
 const r=createRace(room,0),v=r.racers[0];
 v.pendingSecondChance={dice:[1],choice:{}};roll(r,'a',{secondChance:false});
 assert.equal(v.position,0);
 assert.equal(v.used.leftStart,undefined);
});
test('Vozzz leaves START on a six, then chooses a 1–5 move without a die result',()=>{
 const room={players:[{id:'a',name:'A',picks:['c26']},{id:'b',name:'B',picks:['c01']}]};
 const r=createRace(room,0),v=r.racers[0];r.effects={};
 v.pendingSecondChance={dice:[6],choice:{}};roll(r,'a',{secondChance:false});
 assert.equal(v.position,1);assert.equal(v.used.leftStart,true);
 r.turnIndex=0;v.turnRolled=false;
 roll(r,'a',{move:4});
 assert.equal(v.position,5);
 assert.equal(v.lastNatural,'izbor');
});
test('Orgomni bebać displaces a racer landing on its field and is immune to Gljiva gigant',()=>{
 const room={players:[{id:'a',name:'A',picks:['c42']},{id:'b',name:'B',picks:['c02']}]};
 const r=createRace(room,0),baby=r.racers[0],mushroom=r.racers[1];
 r.effects={};baby.position=10;mushroom.position=9;
 const {move}=require('../server/gameLogic');
 move(r,mushroom,1);
 assert.equal(baby.eliminated,false);
 assert.equal(mushroom.position,9);
 assert.match(r.log.join(' '),/imun na Gljivu giganta|čuva svoje polje/);
});
test('Orgomni bebać pushes a racer behind him when he moves onto an occupied field',()=>{
 const room={players:[{id:'a',name:'A',picks:['c42']},{id:'b',name:'B',picks:['c01']}]};
 const r=createRace(room,0),baby=r.racers[0],other=r.racers[1];
 r.effects={};baby.position=9;other.position=11;
 const {move}=require('../server/gameLogic');move(r,baby,2);
 assert.equal(baby.position,11);assert.equal(other.position,10);
});

test('Svopi te does not force a swap when the player declines it',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c05']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.effects={};
 const x=r.racers[0],before=x.position;
 x.pendingSecondChance={dice:[4],choice:{}};roll(r,'a',{secondChance:false});
 assert.equal(x.used.swap,undefined);
 assert.equal(x.position,before+4);
});
test('Svopi te swaps only two different active racers when the player opts in',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c05']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.effects={};r.racers[0].position=5;r.racers[1].position=12;
 xPending(r.racers[0],{swapA:'a',swapB:'b'});roll(r,'a',{secondChance:false});
 assert.equal(r.racers[0].used.swap,true);
 assert.notEqual(r.racers[0].position,5);
});


test('Vještica may choose a normal forward move instead of using her spell',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c32']},{id:'b',name:'B',picks:['c01']}]},0);
 r.firstRoundComplete=true;r.effects={};r.racers[0].position=5;r.racers[1].position=10;
 const old=Math.random;Math.random=()=>0;
 try{roll(r,'a',{target:null});roll(r,'a',{secondChance:false});}finally{Math.random=old;}
 assert.equal(r.racers[0].position,6);
 assert.equal(r.racers[1].position,10);
});

test('Vještica moves a reverse-direction opponent backwards in that opponent’s own direction',()=>{
 const r=createRace({players:[{id:'a',name:'A',picks:['c32']},{id:'b',name:'B',picks:['c33']}]},0);
 r.firstRoundComplete=true;r.effects={};r.racers[0].position=5;r.racers[1].position=20;
 const old=Math.random;Math.random=()=>0;
 try{roll(r,'a',{target:'b'});roll(r,'a',{secondChance:false});}finally{Math.random=old;}
 assert.equal(r.racers[0].position,5);
 assert.equal(r.racers[1].position,21);
});

test('the host can close a room and the client exposes a host-only close control',()=>{
 const server=require('node:fs').readFileSync(require('node:path').join(__dirname,'../server/server.js'),'utf8');
 const client=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/game.js'),'utf8');
 const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8');
 assert.match(server,/s\.on\('closeRoom'/);
 assert.match(server,/player\.id!==room\.hostId/);
 assert.match(server,/target\.emit\('roomClosed'\)/);
 assert.match(client,/emit\('closeRoom'\)/);
 assert.match(client,/socket\.on\('roomClosed'/);
 assert.match(html,/id="closeRoomBtn"/);
});
