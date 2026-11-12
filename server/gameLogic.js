'use strict';
const catalog=require('./characters');
const rand=n=>Math.floor(Math.random()*n);
const clone=o=>JSON.parse(JSON.stringify(o));
function shuffled(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=rand(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function createRace(room,raceNo){
 const negatives=shuffled(Array.from({length:30},(_,i)=>i+1).filter(p=>p!==9&&p!==22)).slice(0,3);
 const effects={[negatives[0]]:-2,[negatives[1]]:-1,[negatives[2]]:-1};
 const racers=room.players.map(p=>{const ch=catalog.find(c=>c.id===p.picks[raceNo]);return {playerId:p.id,playerName:p.name,character:ch,position:ch.ability==='reverse'?32:(ch.ability==='corner'?12:0),finished:false,finishPlace:null,tripped:false,skipNext:false,eliminated:false,lives:4,coins:0,points:ch.ability==='sixPenalty'?4:0,used:{},bonusPoint:false,lastRoll:null,lastNatural:null,lastMove:null,streak:0,shield:false,extraRollAvailable:false};});
 return {number:raceNo+1,negatives,effects,racers,turnIndex:0,round:1,roundTurns:0,firstRoundComplete:false,finishOrder:[],log:[`Utrka ${raceNo+1} počinje!`],status:'running',extraRolls:0,extraSupportGranted:false,turnToken:0};
}
function active(r){return !r.finished&&!r.eliminated;}
function addLog(r,s){r.log.unshift(s);r.log=r.log.slice(0,30);}
function rank(r){return [...r.racers].sort((a,b)=> (a.character.ability==='reverse'?a.position-b.position:b.position-a.position));}
function lastRacer(r,me){return rank(r).filter(active).filter(x=>x.playerId!==me.playerId).at(-1)||null;}
function finish(r,x,place){if(!active(x))return; x.finished=true;x.finishPlace=place;r.finishOrder.push(x.playerId);x.points=place===1?({1:3,2:4,3:4,4:4,5:5}[r.number]||5):place===2?({1:1,2:2,3:2,4:2,5:3}[r.number]||3):0;addLog(r,`${x.character.name} završava na ${place}. mjestu!`);}
function resolveFinish(r,x){if(x.character.ability==='reverse'){if(x.position<=0){finish(r,x,1);for(const y of r.racers)if(y!==x&&active(y)){y.finished=true;y.finishPlace=3;}r.status='finished';}return;}
 if(x.position>=32){finish(r,x,1);} else if(x.position===31){finish(r,x,2);} }
function trip(r,x){if(x.character.ability==='ignoreTrip'||x.character.ability==='tripBoost')return;if(x.character.ability==='shield'&&!x.used.shield){x.used.shield=true;addLog(r,`${x.character.name} poništava efekat PAD.`);return;}x.tripped=true;addLog(r,`${x.character.name} je PAD! Sljedeći potez se oporavlja.`);}
function move(r,x,delta,{backward=false,ignoreEffects=false,passing=true}={}){
 if(!active(x)||!delta)return;
 const reverse=x.character.ability==='reverse';const dir=(backward?-1:1)*(reverse?-1:1);const from=x.position;const to=Math.max(0,Math.min(32,from+dir*delta));
 if(passing&&x.character.ability==='overtake'&&!reverse){let n=r.racers.filter(y=>y!==x&&active(y)&&y.position>Math.min(from,to)&&y.position<Math.max(from,to)).length;const bonus=Math.min(2,n);if(bonus){x.points+=bonus;addLog(r,`${x.character.name} pretječe ${n} trkača: +${bonus} boda.`);}}
 x.position=to;
 if(!ignoreEffects&&r.effects[to]){const effect=r.effects[to];if(reverse){x.position=Math.max(0,x.position+effect);addLog(r,`${x.character.name} koristi negativno polje kao prečicu.`);}else{addLog(r,`${x.character.name} nailazi na ${effect}.`);x.position=Math.max(0,x.position+effect);}}
 if(!ignoreEffects&&!reverse&&(to===9||to===22)){if(x.character.ability==='tripBoost'){x.position=Math.min(32,x.position+2);addLog(r,`${x.character.name} koristi blatni zalet: +2.`);}else trip(r,x);}
 if(!ignoreEffects&&!reverse){for(const y of r.racers){if(y===x||!active(y)||y.position!==x.position)continue;const a=x.character.ability;if(y.character.ability==='collision'){x.skipNext=true;addLog(r,`${x.character.name} je zaustavljen Gvozdenim zidom.`);}else if(x.character.ability==='eliminate'){y.position=Math.max(0,y.position-3);addLog(r,`${y.character.name} je odbačen 3 polja.`);}else if(y.character.ability==='lives'){y.lives--;if(y.lives<=0){y.eliminated=true;addLog(r,`${y.character.name} je ostao bez života.`);}else addLog(r,`${y.character.name} gubi život (${y.lives} preostalo).`);}}}
 resolveFinish(r,x);
}
function turn(r){
 for(let offset=0;offset<r.racers.length;offset++){
  const index=(r.turnIndex+offset)%r.racers.length;
  const candidate=r.racers[index];
  if(active(candidate))return candidate;
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
 }while(checked<=r.racers.length&&!active(r.racers[r.turnIndex]));
 if(checked>r.racers.length||!turn(r))r.status='finished';
}
function roll(r,playerId,choice={}){
 if(r.status!=='running')throw Error('Utrka nije aktivna.');const x=turn(r);if(!x||x.playerId!==playerId)throw Error('Nije tvoj potez.');
 if(x.tripped){x.tripped=false;addLog(r,`${x.character.name} se oporavlja i preskače potez.`);advance(r);return;}
 if(x.skipNext){x.skipNext=false;addLog(r,`${x.character.name} preskače potez.`);advance(r);return;}
 const suppressed=r.firstRoundComplete&&r.racers.some(y=>y!==x&&y.character.ability==='suppression'&&y.position<x.position);const a=suppressed?'suppressed':x.character.ability;const enabled=r.firstRoundComplete;
 if(enabled&&a==='extraSupport'&&!r.extraSupportGranted){r.extraSupportGranted=true;for(const y of r.racers)y.extraRollAvailable=true;addLog(r,`${x.character.name} aktivira Eho: svi dobijaju dodatno bacanje.`);}
 if(enabled&&x.character.ability!=='extraSupport'){for(const y of r.racers)if(y!==x&&y.character.ability==='extraSupport'&&active(y)){y.position=Math.min(32,y.position+1);addLog(r,`${y.character.name} dobija +1 jer je protivnik odigrao potez.`);resolveFinish(r,y);}}
 if(enabled&&a==='magnet'){for(const y of r.racers)if(y!==x&&active(y)&&y.position!==x.position)y.position=Math.max(0,Math.min(32,y.position+(y.position<x.position?1:-1))); addLog(r,'Magnetno polje privlači sve trkače.');}
 if(enabled&&a==='lastManip'&&!x.used.lastManip){const l=lastRacer(r,x);if(l){l.position=Math.max(0,l.position-2);x.position=Math.min(32,x.position+1);x.used.lastManip=true;addLog(r,`${x.character.name} sabotira posljednjeg trkača.`);}}
 if(enabled&&a==='lastPoint'&&!x.bonusPoint&&rank(r).filter(active).at(-1)===x){x.points++;x.bonusPoint=true;addLog(r,`${x.character.name} dobija autsajderski bod.`);}
 if(enabled&&a==='desperation'&&r.racers.filter(y=>y!==x&&active(y)).every(y=>y.position-x.position>=5)){x.points+=3;r.status='finished';addLog(r,`${x.character.name} aktivira Posljednju šansu: +3 boda!`);return;}
 let natural,second=null,moveBy;
 if(a==='fixed'&&enabled&&choice.fixed===true){moveBy=4;natural='—';}
 else if(a==='sixStart'&&enabled&&x.used.leftStart){moveBy=Math.max(1,Math.min(5,Number(choice.move)||1));natural='izbor';}
 else if(a==='twoDice'&&enabled){natural=rand(6)+1;second=rand(6)+1;moveBy=natural===second?natural+second:Math.min(natural,second);}
 else{natural=rand(6)+1;moveBy=natural;}
 if(enabled&&natural===1){for(const y of r.racers)if(y!==x&&active(y)&&y.character.ability==='unlucky'){x.skipNext=true;y.position=Math.min(32,y.position+1);addLog(r,`${y.character.name} aktivira Urok: protivnik gubi naredni potez.`);resolveFinish(r,y);}}
 x.lastNatural=natural;x.coins++;
 if(a==='prediction'&&enabled&&Number(choice.predict)===natural){r.extraRolls=Math.min(1,r.extraRolls+1);addLog(r,`${x.character.name} pogađa rezultat i dobija dodatno bacanje.`);}
 if(a==='lucky'&&enabled&&natural<=2)moveBy=5;
 if(enabled&&r.racers.some(y=>y.character.ability==='weakness'))moveBy=Math.max(1,moveBy-1);
 if(a==='rival'&&enabled)moveBy+=r.racers.filter(y=>y!==x&&active(y)&&y.position>x.position).length;
 if(enabled&&r.racers.some(y=>y!==x&&y.character.ability==='suppression'&&y.position<x.position)&&a!=='reverse')moveBy=Math.max(1,moveBy-1);
 if(a==='even'&&enabled)moveBy=natural%2===0?moveBy+2:-1;
 if(a==='odd'&&enabled)moveBy=natural%2?moveBy+2:-1;
 if(a==='desperate'&&enabled){const isLast=rank(r).filter(active).at(-1)===x;moveBy=isLast?moveBy*3:-moveBy;}
 if(a==='danger'&&enabled){moveBy+=2;if(natural===6){x.position=0;addLog(r,`${x.character.name} rizikuje i vraća se na START!`);advance(r);return;}}
 if(a==='exactFinish'&&enabled){/* This racer has no restriction; the rule is applied to opponents below. */}
 if(enabled&&r.racers.some(y=>y!==x&&y.character.ability==='exactFinish')&&x.character.ability!=='exactFinish'&&x.character.ability!=='reverse'){const remaining=32-x.position;if(remaining<=6&&natural!==remaining)moveBy=0;}
 if(a==='sixPenalty'&&natural===6){x.position=0;x.points=Math.max(0,x.points-1);addLog(r,`${x.character.name} pada na START i gubi bod.`);advance(r);return;}
 if(a==='sixStart'&&enabled&&!x.used.leftStart){if(natural!==6){addLog(r,`${x.character.name} treba šesticu za start.`);advance(r);return;}x.used.leftStart=true;moveBy=1;}
 if(a==='sixStart'&&enabled&&x.used.leftStart&&natural!=='izbor')moveBy=natural;
 if(a==='reverse'&&enabled){moveBy=natural;}
 if(a==='rerollLow'&&enabled&&natural<=2&&!x.used.reroll){x.used.reroll=true;natural=rand(6)+1;moveBy=natural;addLog(r,`${x.character.name} ponavlja mali rezultat.`);}
 if(a==='streak'&&enabled){if(x.lastRoll===natural){x.streak++;if(x.streak>=2){moveBy+=3;x.streak=0;}}else x.streak=0;x.lastRoll=natural;}
 if(a==='lives'&&enabled)moveBy+=4-x.lives;
 if(a==='sixExtra'&&enabled&&natural===6&&!x.used.sixExtra){x.used.sixExtra=true;r.extraRolls=1;}
 if(a==='earthquake'&&enabled&&natural===3){for(const y of r.racers)if(y!==x&&active(y))trip(r,y);addLog(r,'POTRES! Svi protivnici su oboreni.');}
 if(a==='coin'&&(natural===1||natural===6)){const richest=[...r.racers].sort((p,q)=>q.coins-p.coins)[0],poorest=[...r.racers].sort((p,q)=>p.coins-q.coins)[0];if(richest&&poorest&&richest.coins>0){richest.coins--;poorest.coins++;}}
 x.lastMove=moveBy;
 if(a==='reverseControl'&&enabled&&choice.target){const target=r.racers.find(y=>y.playerId===choice.target&&active(y));if(target){target.position=Math.max(0,target.position-natural);addLog(r,`${x.character.name} pomjera protivnika unazad ${natural}.`);advance(r);return;}}
 if(a==='swap'&&enabled&&!x.used.swap&&choice.swapA&&choice.swapB){const aa=r.racers.find(y=>y.playerId===choice.swapA),bb=r.racers.find(y=>y.playerId===choice.swapB);if(aa&&bb&&active(aa)&&active(bb)){[aa.position,bb.position]=[bb.position,aa.position];x.used.swap=true;addLog(r,'Dva trkača mijenjaju mjesta.');}}
 if(a==='double'&&enabled&&!x.used.double&&choice.double){const extra=rand(6)+1;moveBy+=extra;x.used.double=true;addLog(r,`${x.character.name} dobija dodatnih ${extra}.`);}
 if(a==='forcedReroll'&&enabled&&!x.used.forced){for(const y of r.racers)if(y!==x&&active(y)&&y.position>x.position)y.extraRollAvailable=true;x.used.forced=true;addLog(r,'Trkači ispred tebe dobijaju obavezno dodatno bacanje.');}
 if(a==='reverseControl'&&enabled&&!choice.target){} else {addLog(r,`${x.character.name}: ${natural}${second?` + ${second}`:''} → ${moveBy>0?'+':''}${moveBy} polja.`);move(r,x,Math.abs(moveBy),{backward:moveBy<0,ignoreEffects:a==='jump'});}
 if(a==='following'&&enabled&&r.racers.some(y=>y!==x&&active(y)&&y.position===x.position+1))r.extraRolls=1;
 if(r.extraRolls>0&&active(x)&&r.status==='running'){r.extraRolls--;addLog(r,`${x.character.name} igra dodatni potez.`);return;}
 if(x.extraRollAvailable&&active(x)&&r.status==='running'){x.extraRollAvailable=false;addLog(r,`${x.character.name} koristi dodatno bacanje iz Eho sposobnosti.`);return;}
 advance(r);
}
function scoreRace(room,r){for(const x of r.racers){const p=room.players.find(y=>y.id===x.playerId);if(p)p.score+=x.points;}}
module.exports={catalog,createRace,roll,turn,advance,scoreRace,addLog,clone};
