'use strict';
const path=require('path'),http=require('http'),crypto=require('crypto');
const express=require('express');const {Server}=require('socket.io');
const {catalog,createRace,roll,turn,scoreRace,clone}=require('./gameLogic');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:true}});
app.use(express.static(path.join(__dirname,'../public')));app.get('/health',(req,res)=>res.json({ok:true,game:'Ne u basamake, medo je tamo'}));
const rooms=new Map(),socketPlayers=new Map();const code=()=>crypto.randomBytes(3).toString('hex').toUpperCase();
function pub(room,forPlayer){const x={code:room.code,hostId:room.hostId,phase:room.phase,raceCount:room.raceCount,players:room.players.map(p=>({id:p.id,name:p.name,ready:p.ready,score:p.score,connected:p.connected,picks:p.picks,lineupConfirmed:!!p.lineupConfirmed})),draft:room.draft?{pool:room.draft.pool,order:room.draft.order,index:room.draft.index,currentPlayerId:room.draft.order[room.draft.index]?.playerId,currentRace:room.draft.order[room.draft.index]?.race}:null,race:room.race?{...clone(room.race),currentPlayerId:room.race?turn(room.race)?.playerId||null:null}:null,raceResults:room.raceResults,leaderboard:[...room.players].sort((a,b)=>b.score-a.score).map(p=>({id:p.id,name:p.name,score:p.score}))};return x;}
function emit(room){for(const p of room.players)if(p.socketId)io.to(p.socketId).emit('state',pub(room,p.id));}
function recordRaceResult(room){
 if(room.phase!=='race'||!room.race||room.race.status!=='finished'||room.raceScored)return;
 scoreRace(room,room.race);
 room.raceResults[room.raceNo]=room.race.racers.map(x=>({playerId:x.playerId,name:x.playerName,character:x.character.name,place:x.finishPlace,points:x.points,eliminated:x.eliminated}));
 room.raceScored=true;
}
function err(s,msg){s.emit('notice',{type:'error',message:msg});}
function findPlayer(s){const ref=socketPlayers.get(s.id);if(!ref)return null;const room=rooms.get(ref.room);const player=room?.players.find(p=>p.id===ref.player);return room&&player?{room,player}:null;}
function cleanName(n){return String(n||'Takmičar').trim().replace(/[<>]/g,'').slice(0,18)||'Takmičar';}
function removePlayer(room,playerId){
 const index=room.players.findIndex(p=>p.id===playerId);if(index<0)return null;
 const [removed]=room.players.splice(index,1);
 if(room.hostId===playerId&&room.players.length)room.hostId=room.players[0].id;
 if(room.draft){
  const before=room.draft.order.slice(0,room.draft.index).filter(x=>x.playerId===playerId).length;
  room.draft.order=room.draft.order.filter(x=>x.playerId!==playerId);
  room.draft.index=Math.max(0,room.draft.index-before);
  if(room.draft.index>=room.draft.order.length&&room.phase==='draft'){room.players.forEach(p=>p.lineupConfirmed=false);room.phase='lineup';room.raceNo=0;room.race=null;}
 }
 if(room.race){
  const ri=room.race.racers.findIndex(x=>x.playerId===playerId);
  if(ri>=0){
   const wasCurrent=room.race.turnIndex===ri;
   room.race.racers.splice(ri,1);
   room.race.finishOrder=room.race.finishOrder.filter(id=>id!==playerId);
   if(ri<room.race.turnIndex)room.race.turnIndex--;
   if(!room.race.racers.length)room.race.status='finished';
   else if(wasCurrent&&room.race.status==='running'){
    room.race.turnIndex=(ri-1+room.race.racers.length)%room.race.racers.length;
    require('./gameLogic').advance(room.race);
   }
  }
 }
 return removed;
}
io.on('connection',s=>{
 s.emit('catalog',catalog);
 s.on('createRoom',({name})=>{const c=code(),id=crypto.randomUUID();const room={code:c,hostId:id,players:[{id,name:cleanName(name),socketId:s.id,connected:true,ready:false,score:0,picks:[]}],phase:'lobby',raceCount:3,raceNo:0,draft:null,race:null,raceResults:[],raceScored:false};rooms.set(c,room);socketPlayers.set(s.id,{room:c,player:id});s.join(c);s.emit('identity',{room:c,player:id});emit(room);});
 s.on('joinRoom',({room:raw,name})=>{const c=String(raw||'').trim().toUpperCase(),room=rooms.get(c);if(!room)return err(s,'Soba ne postoji. Provjeri kod.');if(room.phase!=='lobby')return err(s,'Utrka je već počela.');if(room.players.length>=6)return err(s,'Soba je puna (maksimalno 6).');const id=crypto.randomUUID();room.players.push({id,name:cleanName(name),socketId:s.id,connected:true,ready:false,score:0,picks:[]});socketPlayers.set(s.id,{room:c,player:id});s.join(c);s.emit('identity',{room:c,player:id});emit(room);});
 s.on('ready',()=>{const z=findPlayer(s);if(!z)return;z.player.ready=!z.player.ready;emit(z.room);});
 s.on('startMatch',({races})=>{const z=findPlayer(s);if(!z)return;const {room,player}=z;if(player.id!==room.hostId)return err(s,'Samo domaćin može pokrenuti igru.');if(room.players.length<2)return err(s,'Potrebna su najmanje 2 igrača.');if(!room.players.every(p=>p.ready))return err(s,'Svi igrači moraju potvrditi spremnost.');room.raceCount=[3,4,5].includes(Number(races))?Number(races):3;room.players.forEach(p=>{p.score=0;p.picks=[];});const pool=clone(catalog).sort(()=>Math.random()-.5).slice(0,room.players.length*room.raceCount);const order=[];for(let r=0;r<room.raceCount;r++)for(const p of room.players)order.push({playerId:p.id,race:r});room.draft={pool,order,index:0};room.phase='draft';emit(room);});
 s.on('pickCharacter',({characterId})=>{const z=findPlayer(s);if(!z)return;const {room,player}=z;if(room.phase!=='draft')return;if(room.draft.order[room.draft.index]?.playerId!==player.id)return err(s,'Nije tvoj red za izbor.');const ch=room.draft.pool.find(c=>c.id===characterId);if(!ch)return err(s,'Lik nije dostupan.');const slot=room.draft.order[room.draft.index];if(player.picks[slot.race])return err(s,'Već si izabrao lika za ovu utrku.');player.picks[slot.race]=ch.id;room.draft.pool=room.draft.pool.filter(c=>c.id!==ch.id);room.draft.index++;if(room.draft.index>=room.draft.order.length){room.players.forEach(p=>{p.lineupConfirmed=false;});room.phase='lineup';room.raceNo=0;room.race=null;}emit(room);});
 s.on('setLineup',({order})=>{
  const z=findPlayer(s);if(!z)return;const {room,player}=z;
  if(room.phase!=='lineup')return err(s,'Raspored nije aktivan.');
  if(player.lineupConfirmed)return err(s,'Već si potvrdio raspored.');
  if(!Array.isArray(order)||order.length!==room.raceCount)return err(s,'Raspored nije ispravan.');
  const chosen=new Set(player.picks);
  if(order.some(id=>!chosen.has(id))||new Set(order).size!==room.raceCount)return err(s,'Svaka kartica mora biti iskorištena tačno jednom.');
  player.picks=order.slice();
  emit(room);
 });
 s.on('confirmLineup',()=>{
  const z=findPlayer(s);if(!z)return;const {room,player}=z;
  if(room.phase!=='lineup')return err(s,'Faza raspoređivanja nije aktivna.');
  if(player.lineupConfirmed)return;
  player.lineupConfirmed=true;
  if(room.players.every(p=>p.lineupConfirmed)){
   room.phase='race';room.raceNo=0;room.race=createRace(room,0);room.raceScored=false;
  }
  emit(room);
 });
 s.on('roll',choice=>{const z=findPlayer(s);if(!z)return;const {room,player}=z;if(room.phase!=='race'||!room.race)return err(s,'Utrka nije aktivna.');try{roll(room.race,player.id,choice||{});recordRaceResult(room);emit(room);}catch(e){err(s,e.message);}});
 s.on('nextRace',()=>{const z=findPlayer(s);if(!z)return;const {room,player}=z;if(player.id!==room.hostId)return err(s,'Samo domaćin može nastaviti.');if(room.phase!=='race'||room.race?.status!=='finished')return err(s,'Trenutna utrka još nije završena.');if(room.raceNo+1>=room.raceCount){room.phase='finished';}else{room.raceNo++;room.race=createRace(room,room.raceNo);room.raceScored=false;}emit(room);});
 s.on('rematch',()=>{const z=findPlayer(s);if(!z)return;const {room,player}=z;if(player.id!==room.hostId)return err(s,'Samo domaćin može pokrenuti novi meč.');if(room.phase!=='finished')return err(s,'Meč još nije završen.');room.players.forEach(p=>{p.score=0;p.picks=[];p.ready=false;p.lineupConfirmed=false;});room.phase='lobby';room.raceNo=0;room.race=null;room.draft=null;room.raceResults=[];room.raceScored=false;emit(room);});
 s.on('leaveRoom',()=>{const z=findPlayer(s);if(!z){socketPlayers.delete(s.id);return;}const {room,player}=z;removePlayer(room,player.id);recordRaceResult(room);socketPlayers.delete(s.id);s.leave(room.code);s.emit('roomLeft');if(!room.players.length)rooms.delete(room.code);else emit(room);});
 s.on('kickPlayer',({playerId})=>{const z=findPlayer(s);if(!z)return;const {room,player}=z;if(player.id!==room.hostId)return err(s,'Samo domaćin može izbacivati igrače.');if(!playerId||playerId===player.id)return err(s,'Ne možeš izbaciti samog sebe.');const target=room.players.find(p=>p.id===playerId);if(!target)return err(s,'Igrač nije pronađen u sobi.');const targetSocket=target.socketId?io.sockets.sockets.get(target.socketId):null;removePlayer(room,target.id);recordRaceResult(room);if(target.socketId)socketPlayers.delete(target.socketId);if(targetSocket){targetSocket.leave(room.code);targetSocket.emit('roomKicked');}if(!room.players.length)rooms.delete(room.code);else emit(room);});
 s.on('disconnect',()=>{
  const z=findPlayer(s);
  if(z){
   z.player.connected=false;z.player.socketId=null;
   if(z.room.race){
    const racer=z.room.race.racers.find(x=>x.playerId===z.player.id);
    if(racer)racer.connected=false;
     // If the disconnected player owns the current turn, advance immediately.
    if(z.room.race.racers[z.room.race.turnIndex]?.playerId===z.player.id)require('./gameLogic').advance(z.room.race);
   }
   emit(z.room);
  }
  socketPlayers.delete(s.id);
 });
 s.on('reconnectRoom',({room:raw,player:id})=>{const room=rooms.get(String(raw||'').toUpperCase()),p=room?.players.find(x=>x.id===id);if(!room||!p)return err(s,'Sačuvana soba više nije dostupna.');p.socketId=s.id;p.connected=true;if(room.race){const racer=room.race.racers.find(x=>x.playerId===p.id);if(racer)racer.connected=true;}socketPlayers.set(s.id,{room:room.code,player:id});s.join(room.code);s.emit('identity',{room:room.code,player:id});emit(room);});
});
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log(`Magical Athlete running on ${port}`));
