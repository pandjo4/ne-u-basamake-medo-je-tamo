'use strict';
const catalog=require('./characters');
const rand=n=>Math.floor(Math.random()*n);
const clone=o=>JSON.parse(JSON.stringify(o));
function shuffled(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=rand(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function createRace(room,raceNo){
 const negatives=shuffled(Array.from({length:30},(_,i)=>i+1).filter(p=>p!==9&&p!==22)).slice(0,3);
 const effects={[negatives[0]]:-2,[negatives[1]]:-1,[negatives[2]]:-1};
 const racers=room.players.map(p=>{const ch=catalog.find(c=>c.id===p.picks[raceNo]),startPosition=ch.ability==='reverse'?32:(ch.ability==='corner'?10:0);return {playerId:p.id,playerName:p.name,character:ch,startPosition,position:startPosition,connected:p.connected!==false,finished:false,finishPlace:null,tripped:false,skipNext:false,eliminated:false,lives:4,coins:ch.ability==='thrifty'?1:0,points:ch.ability==='sixPenalty'?4:0,used:{},abilitiesUsed:{jump:false,rig:false,duplicate:false,thrifty:false,reset:false,secondChance:false},pendingRollAbility:null,pendingSecondChance:null,turnRolled:false,bonusPoint:false,bonusPointCount:0,overtakePoints:0,lastRoll:null,lastNatural:null,lastMove:null,streak:0,shield:false,extraRollAvailable:false};});
 return {number:raceNo+1,negatives,effects,racers,turnIndex:0,round:1,roundTurns:0,firstRoundComplete:false,finishOrder:[],log:[`Utrka ${raceNo+1} počinje!`],status:'running',extraRolls:0,extraSupportGranted:false,turnToken:0};
}
function active(r){return !r.finished&&!r.eliminated;}
function addLog(r,s){r.log.unshift(s);r.log=r.log.slice(0,30);}
function progress(racer){return racer.character.ability==='reverse'?32-racer.position:racer.position;}
function rank(r){return [...r.racers].sort((a,b)=>progress(b)-progress(a));}
function lastRacer(r,me){return rank(r).filter(active).filter(x=>x.playerId!==me.playerId).at(-1)||null;}
function finish(r,x,place){if(!active(x))return; x.finished=true;x.finishPlace=place;r.finishOrder.push(x.playerId);x.points=place===1?({1:3,2:4,3:4,4:4,5:5}[r.number]||5):place===2?({1:1,2:2,3:2,4:2,5:3}[r.number]||3):0;addLog(r,`${x.character.name} završava na ${place}. mjestu!`);}
function enforceGiantBabySpaces(r){
 for(const baby of r.racers.filter(y=>active(y)&&y.character.ability==='giantBaby'&&y.position!==0)){
  for(const other of r.racers){
   if(other===baby||!active(other)||other.position!==baby.position)continue;
   other.position=Math.max(0,baby.position-1);
   addLog(r,`${baby.character.name} čuva svoje polje: ${other.character.name} je pomjeren iza njega.`);
  }
 }
}
function resolveFinish(r,x){
 if(x.character.ability==='reverse'){
  if(x.position<=0){finish(r,x,1);for(const y of r.racers)if(y!==x&&active(y)){y.finished=true;y.finishPlace=3;}r.status='finished';}
  return;
 }
 // The finish tiles are exclusive: first place owns 32, second place owns 31.
 if(r.finishOrder.length===0&&x.position>=32){x.position=32;finish(r,x,1);return;}
 if(r.finishOrder.length===1&&x.position>=31){x.position=31;finish(r,x,2);return;}
 if(r.finishOrder.length>=2){r.status='finished';return;}
 // Before first place is claimed, field 31 is only a passage, not a finish.
 if(r.finishOrder.length===0&&x.position>=31&&x.position<32)x.position=31;
}
function trip(r,x){if(x.character.ability==='heroBonus'||x.character.ability==='tripBoost')return;if(x.character.ability==='shield'&&!x.used.shield){x.used.shield=true;addLog(r,`${x.character.name} poništava efekat PAD.`);return;}x.tripped=true;addLog(r,`${x.character.name} je PAD! Sljedeći potez se oporavlja.`);}
function move(r,x,delta,{backward=false,ignoreEffects=false,passing=true}={}){
 if(!active(x)||!delta)return;
 const reverse=x.character.ability==='reverse';const dir=(backward?-1:1)*(reverse?-1:1);const from=x.position;const to=Math.max(0,Math.min(32,from+dir*delta));
 if(passing&&x.character.ability==='overtake'&&!reverse){let n=r.racers.filter(y=>y!==x&&active(y)&&y.position>Math.min(from,to)&&y.position<Math.max(from,to)).length;const bonus=Math.max(0,Math.min(3-(x.overtakePoints||0),n));if(bonus){x.points+=bonus;x.overtakePoints=(x.overtakePoints||0)+bonus;addLog(r,`${x.character.name} pretječe ${n} trkača: +${bonus} boda (${x.overtakePoints}/3 ukupno).`);}}
 x.position=to;
 if(!ignoreEffects&&x.character.ability==='thrifty'&&(to===9||to===22||Object.hasOwn(r.effects,to))){x.coins++;addLog(r,`${x.character.name} pronalazi novčić (+1).`);}
 if(!ignoreEffects&&r.effects[to]){const effect=r.effects[to];if(reverse){x.position=Math.max(0,x.position+effect);addLog(r,`${x.character.name} koristi negativno polje kao prečicu.`);}else{addLog(r,`${x.character.name} nailazi na ${effect}.`);x.position=Math.max(0,x.position+effect);}}
 if(!ignoreEffects&&!reverse&&(to===9||to===22)){if(x.character.ability==='tripBoost'){x.position=Math.min(32,x.position+2);addLog(r,`${x.character.name} koristi blatni zalet: +2.`);}else trip(r,x);}
 if(!ignoreEffects&&!reverse){for(const y of r.racers){if(y===x||!active(y)||y.position!==x.position)continue;
  // Orgomni bebać nikada ne dijeli polje s drugim trkačem (START je izuzetak).
  if(x.position!==0&&(y.character.ability==='giantBaby'||x.character.ability==='giantBaby')){
   if(y.character.ability==='giantBaby'){
    x.position=Math.max(0,y.position-1);
    addLog(r,x.character.ability==='collision'?`${y.character.name} je imun na Gljivu giganta; ${x.character.name} je pomjeren iza njega.`:`${y.character.name} čuva svoje polje: ${x.character.name} je pomjeren iza njega.`);
    continue;
   }
   if(x.character.ability==='giantBaby'){
    y.position=Math.max(0,x.position-1);
    addLog(r,`${x.character.name} zauzima polje: ${y.character.name} je pomjeren iza njega.`);
    continue;
   }
  }
  // Gljiva gigant ne može eliminisati Orgomnog bebaća.
  if(x.character.ability==='collision'&&y.character.ability==='giantBaby'){
   x.position=Math.max(0,y.position-1);
   addLog(r,`${y.character.name} je imun na Gljivu giganta; napadač je pomjeren iza njega.`);
   continue;
  }
  // Gvozdeni zid eliminiše protivnika kojeg njegov vlasnik pregazi.
  if(x.character.ability==='collision'){y.eliminated=true;addLog(r,`${x.character.name} eliminiše ${y.character.name} Gvozdenim zidom.`);continue;}
  // Četiri života reaguje samo kada neko drugi stane na polje ovog lika.
  if(y.character.ability==='lives'){y.lives--;y.position=Math.min(32,y.position+1);resolveFinish(r,y);if(y.lives<=0){y.eliminated=true;addLog(r,`${y.character.name} je ostao bez života i eliminisan je.`);}else addLog(r,`${y.character.name} gubi život (${y.lives} preostalo) i dobija +1 polje.`);}
 }}
 enforceGiantBabySpaces(r);
 resolveFinish(r,x);
}
function turn(r){
 for(let offset=0;offset<r.racers.length;offset++){
  const index=(r.turnIndex+offset)%r.racers.length;
  const candidate=r.racers[index];
  if(active(candidate)&&candidate.connected!==false)return candidate;
 }
 return null;
}
function advance(r){
 if(r.status!=='running')return;
 if(r.finishOrder.length>=2||r.racers.every(x=>!active(x))){r.status='finished';return;}
 let checked=0;
 do{
  r.turnIndex++;
  if(r.turnIndex>=r.racers.length){
   r.turnIndex=0;
   r.round++;
   if(r.round>1)r.firstRoundComplete=true;
  }
  checked++;
 }while(checked<=r.racers.length&&(!active(r.racers[r.turnIndex])||r.racers[r.turnIndex].connected===false));
 // If every remaining racer is temporarily disconnected, keep the race resumable.
 if(checked>r.racers.length&&!r.racers.some(active))r.status='finished';
}
function roll(r,playerId,choice={}){
 if(r.status!=='running')throw Error('Utrka nije aktivna.');
 const x=turn(r);if(!x||x.playerId!==playerId)throw Error('Nije tvoj potez.');
 if(x.pendingSecondChance){
  if(typeof choice.secondChance!=='boolean')throw Error('Odaberi DA ili NE za DRUGU ŠANSU.');
  const pending=x.pendingSecondChance;let dice=pending.dice.slice();
  if(choice.secondChance===true){
   if(x.abilitiesUsed.secondChance)throw Error('DRUGA ŠANSA je već iskorištena.');
   x.abilitiesUsed.secondChance=true;
   const old=x.pendingRollAbility,a=x.character.ability,count=a==='twoDice'&&r.firstRoundComplete?2:1;
   const one=()=>{if(old?.type==='rig'){const faces=[1,2,3,4,5,6].filter(n=>n!==old.value&&!(a==='heroBonus'&&n+1===old.value));return faces[rand(faces.length)];}return rand(6)+1;};
   dice=Array.from({length:count},one);
   addLog(r,`${x.character.name} koristi DRUGU ŠANSU: odbacuje prvi rezultat.`);
  }else addLog(r,`${x.character.name} zadržava prvi rezultat kockice.`);
  const savedChoice=pending.choice||{};x.pendingSecondChance=null;
  return resolveRoll(r,playerId,savedChoice,dice);
 }
 if(x.tripped||x.skipNext)return resolveRoll(r,playerId,choice,null);
 const a=x.character.ability;
 const custom=(a==='paidMove'&&choice.paidMove===true)||(a==='fixed'&&choice.fixed===true)||(a==='sixStart'&&x.used.leftStart&&Number.isInteger(Number(choice.move)));
 if(!x.abilitiesUsed?.secondChance&&!custom){
  const pending=x.pendingRollAbility;
  const one=()=>{if(pending?.type==='duplicate')return pending.value;if(pending?.type==='rig'){const faces=[1,2,3,4,5,6].filter(n=>n!==pending.value&&!(a==='heroBonus'&&n+1===pending.value));return faces[rand(faces.length)];}return rand(6)+1;};
  const dice=a==='twoDice'&&r.firstRoundComplete&&pending?.type==='duplicate'?[pending.value,pending.second??pending.value]:Array.from({length:a==='twoDice'&&r.firstRoundComplete?2:1},one);
  x.turnRolled=true;x.pendingSecondChance={dice,choice:clone(choice||{})};return;
 }
 return resolveRoll(r,playerId,choice,null);
}
function resolveRoll(r,playerId,choice={},forcedDice=null){
 if(r.status!=='running')throw Error('Utrka nije aktivna.');const x=turn(r);if(!x||x.playerId!==playerId)throw Error('Nije tvoj potez.');x.turnRolled=true;
 if(x.tripped){x.tripped=false;addLog(r,`${x.character.name} se oporavlja i preskače potez.`);advance(r);return;}
 if(x.skipNext){x.skipNext=false;addLog(r,`${x.character.name} preskače potez.`);advance(r);return;}
 const isExtraTurn=!!x.pendingExtraTurn||!!x.extraRollAvailable;
 x.pendingExtraTurn=false;
 if(isExtraTurn){for(const echo of r.racers){if(echo!==x&&active(echo)&&echo.character.ability==='extraSupport'){echo.position=Math.min(32,echo.position+2);addLog(r,`${echo.character.name} odjekuje dodatno bacanje protivnika: +2 polja.`);resolveFinish(r,echo);}}x.extraRollAvailable=false;}
 const suppressed=r.firstRoundComplete&&r.racers.some(y=>y!==x&&y.character.ability==='suppression'&&y.position<x.position);const a=suppressed?'suppressed':x.character.ability;const enabled=r.firstRoundComplete;

 if(enabled&&a==='magnet'){for(const y of r.racers)if(y!==x&&active(y)&&y.position!==x.position)y.position=Math.max(0,Math.min(32,y.position+(y.position<x.position?1:-1))); addLog(r,'Magnetno polje privlači sve trkače.');}
 if(enabled&&a==='lastManip'&&!x.used.lastManip){const l=lastRacer(r,x);if(l){l.position=Math.max(0,l.position-2);x.position=Math.min(32,x.position+1);x.used.lastManip=true;addLog(r,`${x.character.name} sabotira posljednjeg trkača.`);}}
 if(enabled&&a==='lastPoint'&&x.bonusPointCount<2&&rank(r).filter(active).at(-1)===x){x.points++;x.bonusPointCount++;addLog(r,`${x.character.name} dobija autsajderski bod (${x.bonusPointCount}/2).`);}
 if(enabled&&a==='desperation'&&r.racers.filter(y=>y!==x&&active(y)).every(y=>y.position-x.position>=5)){x.points+=3;r.status='finished';addLog(r,`${x.character.name} aktivira Posljednju šansu: +3 boda!`);return;}
 let natural,second=null,moveBy;
 const pending=x.pendingRollAbility; x.pendingRollAbility=null;
 const rollDie=()=>{if(forcedDice&&forcedDice.length)return forcedDice.shift();if(pending?.type==='rig'){const faces=[1,2,3,4,5,6].filter(n=>n!==pending.value&&!(a==='heroBonus'&&n+1===pending.value));return faces[rand(faces.length)];}if(pending?.type==='duplicate')return pending.value;return rand(6)+1;};
 if(a==='paidMove'&&enabled&&choice.paidMove===true&&!pending){if(x.coins<1)throw Error('Nemaš dovoljno novčića za posebno kretanje.');x.coins--;moveBy=Math.max(1,Math.min(8,Number(choice.move)||1));natural='kupljeno';}
 else if(a==='fixed'&&enabled&&choice.fixed===true&&!pending){moveBy=4;natural='—';}
 else if(a==='sixStart'&&x.used.leftStart&&!pending){moveBy=Math.max(1,Math.min(5,Number(choice.move)||1));natural='izbor';}
 else if(a==='twoDice'&&enabled){natural=rollDie();second=forcedDice&&forcedDice.length?forcedDice.shift():(pending?.type==='duplicate'?(pending.second??null):rollDie());moveBy=second===null?natural:(natural===second?natural+second:Math.min(natural,second));}
 else{natural=rollDie();if(a==='heroBonus'&&pending?.type!=='duplicate')natural+=1;moveBy=natural;}
 if(enabled&&natural===1){for(const y of r.racers)if(y!==x&&active(y)&&y.character.ability==='unlucky'){x.skipNext=true;y.position=Math.min(32,y.position+1);addLog(r,`${y.character.name} aktivira Urok: protivnik gubi naredni potez.`);resolveFinish(r,y);}}
 x.lastNatural=natural;x.lastSecond=second;if(!(a==='paidMove'&&natural==='kupljeno'))x.coins+=1;
 if(a==='prediction'&&enabled&&Number(choice.predict)===natural){r.extraRolls=Math.min(1,r.extraRolls+1);addLog(r,`${x.character.name} pogađa rezultat i dobija dodatno bacanje.`);}
 if(a==='lucky'&&enabled&&natural<=2)moveBy=5;
 if(enabled&&r.racers.some(y=>y!==x&&active(y)&&y.character.ability==='weakness'))moveBy=Math.max(1,moveBy-1);
 if(a==='rival'&&enabled)moveBy+=r.racers.filter(y=>y!==x&&active(y)&&y.position>x.position).length;
 if(enabled&&r.racers.some(y=>y!==x&&y.character.ability==='suppression'&&y.position<x.position)&&a!=='reverse')moveBy=Math.max(1,moveBy-1);
 if(a==='even'&&enabled)moveBy=natural%2===0?moveBy+2:-1;
 if(a==='odd'&&enabled)moveBy=natural%2?moveBy+2:-1;
 if(a==='desperate'&&enabled){const isLast=rank(r).filter(active).at(-1)===x;moveBy=isLast?moveBy*3:-moveBy;}
 if(a==='danger'&&enabled){moveBy+=2;if(natural===6){x.position=0;addLog(r,`${x.character.name} rizikuje i vraća se na START!`);advance(r);return;}}
 if(a==='exactFinish'&&enabled){/* This racer has no restriction; the rule is applied to opponents below. */}
 if(enabled&&r.racers.some(y=>y!==x&&y.character.ability==='exactFinish')&&x.character.ability!=='exactFinish'&&x.character.ability!=='reverse'){const remaining=32-x.position;if(remaining<=6&&natural!==remaining)moveBy=0;}
 if(a==='sixPenalty'&&natural===6){x.position=0;x.points=Math.max(0,x.points-1);addLog(r,`${x.character.name} pada na START i gubi bod.`);advance(r);return;}
 if(a==='sixStart'&&!x.used.leftStart&&x.position===0){if(natural!==6){addLog(r,`${x.character.name} treba šesticu za start.`);advance(r);return;}x.used.leftStart=true;moveBy=1;}
 if(a==='reverse'&&enabled){moveBy=natural;}
 if(a==='rerollLow'&&enabled&&natural<=2&&!x.used.reroll){x.used.reroll=true;natural=rand(6)+1;moveBy=natural;addLog(r,`${x.character.name} ponavlja mali rezultat.`);}
 if(a==='streak'&&enabled){if(x.lastRoll===natural){x.streak++;if(x.streak>=2){moveBy+=3;x.streak=0;}}else x.streak=0;x.lastRoll=natural;}
 if(a==='lives'&&enabled)moveBy+=4-x.lives;
 if(a==='sixExtra'&&enabled&&natural===6&&!x.used.sixExtra){x.used.sixExtra=true;r.extraRolls=1;}
 if(a==='earthquake'&&enabled&&natural===3){for(const y of r.racers)if(y!==x&&active(y))trip(r,y);addLog(r,'POTRES! Svi protivnici su oboreni.');}
 if(a==='coin'&&(natural===1||natural===6)){const richest=[...r.racers].sort((p,q)=>q.coins-p.coins)[0],poorest=[...r.racers].sort((p,q)=>p.coins-q.coins)[0];if(richest&&poorest&&richest.coins>0){richest.coins--;poorest.coins++;}}
 x.lastMove=moveBy;
 if(a==='reverseControl'&&enabled&&choice.target&&choice.target!==x.playerId){const target=r.racers.find(y=>y.playerId===choice.target&&active(y));if(target){move(r,target,natural,{backward:true});addLog(r,`${x.character.name} vraća ${target.character.name} unazad ${natural} polje(a).`);advance(r);return;}}
 if(a==='swap'&&enabled&&!x.used.swap&&choice.swapA&&choice.swapB){const aa=r.racers.find(y=>y.playerId===choice.swapA),bb=r.racers.find(y=>y.playerId===choice.swapB);if(aa&&bb&&aa!==bb&&active(aa)&&active(bb)){[aa.position,bb.position]=[bb.position,aa.position];x.used.swap=true;addLog(r,'Dva trkača mijenjaju mjesta.');}}
 if(a==='double'&&enabled&&(x.used.double||0)<2&&choice.double){const extra=rand(6)+1;moveBy+=extra;x.used.double=(x.used.double||0)+1;addLog(r,`${x.character.name} dobija dodatnih ${extra} (${x.used.double}/2).`);}
 if(a==='reroute'&&enabled&&!x.used.reroute){x.used.reroute=true;addLog(r,`${x.character.name} aktivira trajni bonus +1 kretanje.`);}
 if(a==='reroute'&&enabled&&x.used.reroute)moveBy+=1;
 addLog(r,`${x.character.name}: ${natural}${second?` + ${second}`:''} → ${moveBy>0?'+':''}${moveBy} polja.`);move(r,x,Math.abs(moveBy),{backward:moveBy<0,ignoreEffects:a==='jump'});
 if(a==='following'&&enabled&&r.racers.some(y=>y!==x&&active(y)&&y.position===x.position+1))r.extraRolls=1;
 if(r.extraRolls>0&&active(x)&&r.status==='running'){r.extraRolls--;x.pendingExtraTurn=true;addLog(r,`${x.character.name} igra dodatni potez.`);return;}
 if(x.extraRollAvailable&&active(x)&&r.status==='running'){x.extraRollAvailable=false;x.pendingExtraTurn=true;addLog(r,`${x.character.name} koristi dodatno bacanje.`);return;}
 advance(r);
}
function activateAbility(r,playerId,type,value){
 if(r.status!=='running')throw Error('Utrka nije aktivna.');
 const x=turn(r);if(!x||x.playerId!==playerId)throw Error('Nije tvoj potez.');
 if(!['jump','rig','duplicate','thrifty','reset'].includes(type))throw Error('Nepoznata sposobnost.');
 if(x.abilitiesUsed?.[type])throw Error('Ovu sposobnost već si iskoristio u ovoj utrci.');
 if(x.tripped||x.skipNext)throw Error('Ne možeš aktivirati sposobnost dok preskačeš potez.');
 if(['thrifty','reset'].includes(type)&&x.turnRolled)throw Error('Ovu sposobnost možeš aktivirati samo prije bacanja kockice.');
 if(x.pendingRollAbility||x.pendingSecondChance)throw Error('Prvo baci kockicu ili završi trenutnu odluku o kockici.');
 if(type==='thrifty'){
  x.abilitiesUsed.thrifty=true;x.coins++;addLog(r,`${x.character.name} aktivira ŠTEDIŠU: preskače bacanje i dobija 1 novčić.`);advance(r);return;
 }
 if(type==='reset'){
  if(x.position===(x.startPosition??0))throw Error('Već se nalaziš na START polju.');
  const position=progress(x),reward=position>=20?2:position>=10?1:0;
  x.abilitiesUsed.reset=true;x.coins+=reward;x.position=x.startPosition??0;
  addLog(r,`${x.character.name} aktivira RESET: vraća se na START${reward?` i dobija ${reward} novčić${reward===1?'':'a'}`:' bez novčane nagrade'}.`);
  advance(r);return;
 }
 if(type==='jump'){
  x.abilitiesUsed.jump=true;addLog(r,`${x.character.name} aktivira SKOK: +2 polja.`);
  move(r,x,2);advance(r);return;
 }
 if(type==='rig'){
  const n=Number(value);if(!Number.isInteger(n)||n<1||n>6)throw Error('Izaberi broj od 1 do 6.');
  x.abilitiesUsed.rig=true;x.pendingRollAbility={type:'rig',value:n};
  addLog(r,`${x.character.name} namješta kockicu: ${n} se ne može pojaviti.`);return;
 }
 if(!Number.isInteger(x.lastNatural)||x.lastNatural<1||x.lastNatural>6)throw Error('Prvo moraš barem jednom baciti kockicu.');
 x.abilitiesUsed.duplicate=true;x.pendingRollAbility={type:'duplicate',value:x.lastNatural,second:x.lastSecond};
 addLog(r,`${x.character.name} aktivira DUPLIKAT: sljedeće bacanje je ${x.lastNatural}.`);
}
function scoreRace(room,r){for(const x of r.racers){const p=room.players.find(y=>y.id===x.playerId);if(p)p.score+=x.points;}}
module.exports={catalog,createRace,roll,turn,advance,activateAbility,scoreRace,rank,addLog,clone,move};
