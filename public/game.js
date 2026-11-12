'use strict';
const socket=io();let me=null,roomCode=null,state=null,catalog=[],myId=null,raceChoice=3,soundOn=false;
const $=id=>document.getElementById(id);const screens=['home','lobby','draft','lineup','race','results'];
let visualPositions={},animationBusy=false,stateQueue=[];
function show(id){const changed=!$(id).classList.contains('active');screens.forEach(x=>$(x).classList.toggle('active',x===id));if(changed)window.scrollTo({top:0,behavior:'smooth'});}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
function emit(name,data={}){socket.emit(name,data)}
function player(){return state?.players.find(p=>p.id===myId)}
function avatarFor(c){const map={fox:'🦊',golem:'🗿',imp:'👿',sprite:'🧚',pixie:'🧝‍♀️',kitsune:'🦊',owl:'🦉',bell:'🔔',witch:'🧙',troll:'👹',rabbit:'🐇',goblin:'👺',ogre:'👹',gremlin:'👾',unicorn:'🦄',wolf:'🐺',raven:'🐦‍⬛',deer:'🦌',dragon:'🐉',minotaur:'🐂',phantom:'👻',panther:'🐈‍⬛',phoenix:'🔥',cheetah:'🐆',beetle:'🪲',bear:'🐻',turtle:'🐢',badger:'🦡',mongoose:'🐾',knight:'🛡️',stone:'🪨',puppet:'🪆',skeleton:'💀',magnet:'🧲',slime:'🟢',jackal:'🐕',griffin:'🦅',boar:'🐗',jellyfish:'🪼',comet:'☄️'};return map[c?.species]||'✨';}
function image(c,cls=''){return `<img class="${cls}" src="${c.image}" alt="${c.name}" onerror="this.outerHTML='<span class=\'fallback\'>${avatarFor(c)}</span>'">`;}
function connectIdentity(){
 try{const saved=JSON.parse(localStorage.getItem('ma_identity')||'null');if(saved?.room&&saved?.player)emit('reconnectRoom',saved);}
 catch(e){localStorage.removeItem('ma_identity');}
}
socket.on('connect',connectIdentity);socket.on('disconnect',()=>toast('Veza je prekinuta. Pokušavamo ponovo uspostaviti vezu...'));socket.on('connect_error',()=>toast('Ne možemo se povezati sa serverom. Pokušaj ponovo.'));socket.on('catalog',x=>catalog=x);socket.on('identity',x=>{me=x.player;myId=x.player;roomCode=x.room;localStorage.setItem('ma_identity',JSON.stringify(x));toast('Povezan si sa sobom '+x.room);});
socket.on('state',x=>{stateQueue.push(x);processStateQueue();});
async function processStateQueue(){
 if(animationBusy||!stateQueue.length)return;
 const next=stateQueue.pop(),prev=state;stateQueue.length=0;const moves=[];
 if(prev?.phase==='race'&&next?.phase==='race'&&prev.race&&next.race&&prev.race.number===next.race.number){
  for(const nr of next.race.racers){const pr=prev.race.racers.find(x=>x.playerId===nr.playerId);if(pr&&pr.position!==nr.position)moves.push({id:nr.playerId,from:visualPositions[nr.playerId]??pr.position,to:nr.position});}
 }
 state=next;
 if(next.phase==='lobby')visualPositions={};
 if(next.phase==='race'&&prev?.race&&next.race&&prev.race.number!==next.race.number)visualPositions=Object.fromEntries(next.race.racers.map(r=>[r.playerId,r.position]));
 if(moves.length){
  animationBusy=true;
  for(const m of moves)visualPositions[m.id]=m.from;
  render();
  const maxSteps=Math.max(...moves.map(m=>Math.abs(m.to-m.from)));
  for(let step=0;step<maxSteps;step++){
   for(const m of moves){const cur=visualPositions[m.id];if(cur!==m.to)visualPositions[m.id]=cur+(m.to>cur?1:-1);}
   render();
   await new Promise(resolve=>setTimeout(resolve,240));
  }
  for(const m of moves)visualPositions[m.id]=m.to;
  animationBusy=false;
 }
 if(state?.race)for(const r of state.race.racers)if(visualPositions[r.playerId]===undefined)visualPositions[r.playerId]=r.position;
 render();processStateQueue();
}socket.on('notice',x=>toast(x.message));
function render(){if(!state)return;$('lobbyCode').textContent=state.code;$('playerCount').textContent=`${state.players.length} / 6`;
 $('playerList').innerHTML=state.players.map((p,i)=>`<div class="player-row"><div class="player-avatar">${['🦊','🦉','🐉','🦄','🐺','🐸'][i]}</div><div class="player-meta"><b>${esc(p.name)} ${p.id===state.hostId?'✦':''}</b><small>${p.id===state.hostId?'DOMAĆIN':'TAKMIČAR'} · ${p.connected?'POVEZAN':'PONOVNO POVEZIVANJE'}</small></div><span class="${p.ready?'ready-tag':'waiting-tag'}">${p.ready?'✓ SPREMAN':'ČEKA'}</span></div>`).join('');
 $('readyBtn').textContent=player()?.ready?'OTKAŽI SPREMNOST':'SPREMAN SAM';$('readyBtn').classList.toggle('secondary',!!player()?.ready);$('startBtn').hidden=state.hostId!==myId;$('startBtn').disabled=!state.players.every(p=>p.ready)||state.players.length<2;$('hostHint').textContent=state.hostId===myId?'Kao domaćin pokrećeš igru kada svi budu spremni.':'Čekamo domaćina da pokrene utrku.';
 if(state.phase==='lobby')show('lobby');if(state.phase==='draft'){show('draft');renderDraft();}if(state.phase==='lineup'){show('lineup');renderLineup();}if(state.phase==='race'){show('race');renderRace();}if(state.phase==='finished'){show('results');renderResults();}}
function renderDraft(){const d=state.draft,cur=d.order[d.index],mine=cur?.playerId===myId;$('draftInfo').textContent=mine?`Tvoj izbor · Utrka ${cur.race+1} od ${state.raceCount}. Izaberi jednog šampiona.`:`${state.players.find(p=>p.id===cur?.playerId)?.name||'Igrač'} bira lika za utrku ${cur?.race+1}.`;$('draftProgress').textContent=`IZBOR ${d.index+1} / ${d.order.length}`;$('draftGrid').innerHTML=d.pool.map(c=>`<article class="character-card" data-id="${c.id}"><div class="character-art" style="--c:${c.color}22">${image(c)}</div><div class="character-info"><h3>${c.name}</h3><div class="ability-title">${c.title}</div><p>${c.description}</p><button class="pick-btn" ${!mine?'disabled':''}>${mine?'ODABERI ŠAMPIONA':'ČEKA SE IZBOR'}</button></div></article>`).join('');document.querySelectorAll('.character-card').forEach(el=>el.onclick=()=>{if(mine)emit('pickCharacter',{characterId:el.dataset.id});});}
function renderLineup(){
 const mePlayer=player(),confirmed=!!mePlayer?.lineupConfirmed;
 $('lineupInfo').textContent=confirmed?'Tvoj raspored je potvrđen. Čekamo ostale igrače.':'Poredaj kartice po željenom redoslijedu utrka. Koristi strelice za promjenu pozicije.';
 $('lineupProgress').textContent=`${state.players.filter(p=>p.lineupConfirmed).length} / ${state.players.length} POTVRDILO`;
 $('lineupGrid').innerHTML=(mePlayer?.picks||[]).map((id,i)=>{const c=catalog.find(x=>x.id===id);if(!c)return '';return `<article class="lineup-card"><div class="lineup-number">UTRKA ${i+1}</div><div class="lineup-art">${image(c)}</div><div class="lineup-meta"><b>${esc(c.name)}</b><small>${esc(c.title||'')}</small></div><div class="lineup-controls"><button data-up="${i}" ${i===0||confirmed?'disabled':''} aria-label="Pomjeri gore">▲</button><button data-down="${i}" ${i===mePlayer.picks.length-1||confirmed?'disabled':''} aria-label="Pomjeri dolje">▼</button></div></article>`;}).join('');
 document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const a=[...player().picks],i=Number(b.dataset.up);[a[i-1],a[i]]=[a[i],a[i-1]];emit('setLineup',{order:a});});
 document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>{const a=[...player().picks],i=Number(b.dataset.down);[a[i+1],a[i]]=[a[i],a[i+1]];emit('setLineup',{order:a});});
 $('lineupStatus').textContent=state.players.filter(p=>p.lineupConfirmed).map(p=>p.name).join(', ')||'Niko još nije potvrdio raspored.';
 $('confirmLineupBtn').disabled=confirmed;
 $('confirmLineupBtn').textContent=confirmed?'RASPORED POTVRĐEN ✓':'POTVRDI RASPORED ↗';
 $('confirmLineupBtn').onclick=()=>emit('confirmLineup');
}
function coords(){const m={};for(let c=0;c<10;c++)m[c+1]=[0,c];for(let r=1;r<=6;r++)m[10+r]=[r,9];for(let c=9;c>=0;c--)m[26-c]=[7,c];for(let r=6;r>=1;r--)m[32-r+1]=[r,0];return m;}
function renderRace(){const r=state.race;if(!r)return;const active=r.racers.find(x=>x.playerId===myId),current=r.racers.find(x=>x.playerId===r.currentPlayerId);$('raceEyebrow').textContent=`UTRKA ${r.number} / ${state.raceCount}`;$('raceStatus').textContent=r.firstRoundComplete?'POSEBNE SPOSOBNOSTI SU AKTIVNE':`PRVA RUNDA · RUNDA ${r.round}`;
 const pos=coords(),cells=[];for(let n=1;n<=32;n++){const [row,col]=pos[n],trip=n===9||n===22,neg=r.effects[n],finish=n>=31;const pieces=r.racers.filter(x=>(visualPositions[x.playerId]??x.position)===n&&!x.eliminated).map(x=>image(x.character,'piece '+(x.tripped?'tripped ':'')+(animationBusy&&visualPositions[x.playerId]!==x.position?'moving':''))).join('');cells.push(`<div class="cell ${trip?'trip':''} ${neg?'negative':''} ${finish?'finish':''} ${n===32?'gold-finish':''} ${n===31?'silver-finish':''}" style="grid-row:${row+1};grid-column:${col+1}"><span class="num">${n}</span><div class="pieces">${pieces}</div>${trip?'<span class="cell-tag">PAD</span>':neg?`<span class="cell-tag">${neg}</span>`:n===31?'<span class="cell-tag">2. MJESTO</span>':n===32?'<span class="cell-tag">1. MJESTO</span>':''}</div>`);}
 $('track').innerHTML=cells.join('')+`<div class="board-center"><b>NE U BASAMAKE,<br>MEDO JE TAMO</b><div class="center-roster">${r.racers.map(x=>`<div class="center-roster-card">${image(x.character)}<small>${esc(x.character.title||x.character.name)}</small></div>`).join('')}</div><span>STVORENJA OVE UTRKE</span></div>`;
 const isTurn=current?.playerId===myId&&r.status==='running';$('currentTurn').innerHTML=current?`<div class="turn-player">${image(current.character)}<div><b>${esc(current.character.name)}</b><small>${esc(current.playerName)} · POLJE ${(visualPositions[current.playerId]??current.position)===0?'START':(visualPositions[current.playerId]??current.position)}</small></div></div>`:(r.status==='running'?'<p>Svi aktivni takmičari su trenutno van veze. Čekamo povratak igrača.</p>':'<p>Utrka je završena.</p>');
 $('rollBtn').disabled=!isTurn||r.status!=='running'||animationBusy;$('rollBtn').textContent=isTurn?'BACI KOCKICU':'ČEKAJ POTEZ';$('die').textContent=active?.lastNatural??'?';
 const twoDice=active?.character?.ability==='twoDice';$('die2').hidden=!twoDice;$('die2').textContent=active?.lastSecond??'?';
 $('rollResult').textContent=active?.lastNatural!==null&&active?.lastNatural!==undefined?`Rezultat: ${active.lastNatural}${twoDice?` i ${active.lastSecond??'?'}`:''} · Kretanje: ${active.lastMove??'-'}`:(isTurn?'Tvoj potez je spreman.':'Čekamo sljedećeg takmičara...');
 $('standings').innerHTML=[...r.racers].sort((a,b)=>a.character.ability==='reverse'?(a.position-b.position):(b.position-a.position)).map((x,i)=>`<div class="standing-row ${x.playerId===current?.playerId?'current':''}"><span class="rank">${i+1}.</span><b>${esc(x.playerName)}</b><small>${x.finished?'CILJ':x.eliminated?'ISPao':x.tripped?'PAO':`POLJE ${x.position}`} · ${x.points} BOD. · ${x.coins} NOV.</small></div>`).join('');$('raceLog').innerHTML=r.log.slice(0,10).map(s=>`<div class="log-entry">${esc(s)}</div>`).join('');
 $('raceBottom').innerHTML=r.status==='finished'?`${raceScoreTable()}<button class="primary" id="nextRaceBtn">${r.number>=state.raceCount?'PRIKAŽI KONAČNE REZULTATE':'SLJEDEĆA UTRKA ↗'}</button>`:'';if($('nextRaceBtn')){ $('nextRaceBtn').disabled=state.hostId!==myId; $('nextRaceBtn').textContent=state.hostId===myId?$('nextRaceBtn').textContent:'ČEKA SE DOMAĆIN'; $('nextRaceBtn').onclick=()=>emit('nextRace'); }
}
function raceScoreTable(){
 const results=state.raceResults||[];
 const rows=state.players.map(p=>{const last=results[results.length-1]?.find(x=>x.playerId===p.id);return `<tr><td>${esc(p.name)}</td><td>${last?.place?`${last.place}.`:'-'}</td><td>${last?.points??0}</td><td>${p.score}</td></tr>`;});
 return `<div class="panel race-score-panel"><div class="panel-title">BODOVI NAKON UTRKE ${state.race?.number||1}<span>UKUPNI REZULTAT</span></div><div class="score-table-wrap"><table class="score-table"><thead><tr><th>IGRAČ</th><th>MJESTO</th><th>OVAJ PUT</th><th>UKUPNO</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}
function renderResults(){const sorted=[...state.leaderboard].sort((a,b)=>b.score-a.score);$('winnerText').textContent=`${sorted[0]?.name||'Takmičar'} osvaja ukupnu pobjedu u igri Ne u basamake, medo je tamo!`;$('finalBoard').innerHTML=sorted.map((p,i)=>`<div class="final-row"><span class="medal">${['🥇','🥈','🥉','🏅','🏅','🏅'][i]}</span><b>${esc(p.name)}</b><strong>${p.score} BOD.</strong></div>`).join('');$('rematchBtn').disabled=state.hostId!==myId;$('rematchBtn').textContent=state.hostId===myId?'NOVA IGRA ↗':'ČEKA SE DOMAĆIN';}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('createBtn').onclick=()=>emit('createRoom',{name:$('playerName').value});$('joinBtn').onclick=()=>emit('joinRoom',{room:$('roomCode').value,name:$('playerName').value});$('readyBtn').onclick=()=>emit('ready');$('startBtn').onclick=()=>emit('startMatch',{races:raceChoice});$('copyCode').onclick=()=>{navigator.clipboard?.writeText(state?.code||'');toast('Kod sobe je kopiran.');};document.querySelectorAll('[data-races]').forEach(b=>b.onclick=()=>{raceChoice=Number(b.dataset.races);document.querySelectorAll('[data-races]').forEach(x=>x.classList.toggle('selected',x===b));});$('rollBtn').onclick=()=>{const d=$('die');d.classList.add('rolling');d.textContent='⚄';setTimeout(()=>d.classList.remove('rolling'),550);emit('roll',{});};$('soundToggle').onclick=()=>{soundOn=!soundOn;$('soundToggle').style.color=soundOn?'var(--mint)':'var(--gold)';toast('Zvučni efekti još nisu dodani u ovu verziju igre.');};$('rematchBtn').onclick=()=>emit('rematch');$('modalClose').onclick=()=>$('modal').hidden=true;
// Contextual decisions for abilities that need player input.
$('rollBtn').onclick=()=>{
 const r=state?.race,x=r?.racers.find(y=>y.playerId===myId);if(!x)return;
 const a=x.character.ability,enabled=r.firstRoundComplete;let choice={};
 const ask=(title,body,fields,submitLabel='POTVRDI')=>{ $('modalContent').innerHTML=`<div class="eyebrow">POSEBNA SPOSOBNOST</div><h3>${title}</h3><p>${body}</p>${fields}<button class="primary full" id="decisionSubmit">${submitLabel}</button>`;$('modal').hidden=false;$('decisionSubmit').onclick=()=>{const read=id=>$(id)?.value;choice={};if(a==='prediction')choice.predict=Number(read('predict'));if(a==='fixed')choice.fixed=read('fixed')==='yes';if(a==='sixStart')choice.move=Number(read('move'));if(a==='reverseControl')choice.target=read('target');if(a==='swap'){choice.swapA=read('swapA');choice.swapB=read('swapB');}if(a==='double')choice.double=read('double')==='yes';$('modal').hidden=true;sendRoll(choice);};};
 const opts=r.racers.filter(y=>y.playerId!==myId&&!y.finished&&!y.eliminated).map(y=>`<option value="${y.playerId}">${esc(y.playerName)} - ${esc(y.character.name)}</option>`).join('');
 if(enabled&&a==='prediction')return ask('Proročanstvo','Pogodi prirodni rezultat kockice.',`<select id="predict">${[1,2,3,4,5,6].map(n=>`<option>${n}</option>`).join('')}</select>`);
 if(enabled&&a==='fixed'&&!x.used.fixed)return ask('Kameni korak','Želiš li izabrati fiksno kretanje od 4 polja?',`<select id="fixed"><option value="yes">Da, 4 polja</option><option value="no">Ne, baci kockicu</option></select>`);
 if(enabled&&a==='sixStart'&&x.used.leftStart)return ask('Kontrolisani korak','Odaberi kretanje od 1 do 5 polja.',`<select id="move">${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select>`);
 if(enabled&&a==='reverseControl')return ask('Gospodar lutaka','Odaberi protivnika kojeg ćeš pomjeriti unazad.',`<select id="target">${opts}</select>`);
 if(enabled&&a==='swap'&&!x.used.swap&&r.racers.length>1)return ask('Zamjena mjesta','Odaberi dva aktivna trkača čije pozicije želiš zamijeniti.',`<select id="swapA">${r.racers.filter(y=>!y.finished&&!y.eliminated).map(y=>`<option value="${y.playerId}">${esc(y.playerName)}</option>`).join('')}</select><select id="swapB">${r.racers.filter(y=>!y.finished&&!y.eliminated).map(y=>`<option value="${y.playerId}">${esc(y.playerName)}</option>`).join('')}</select>`);
 if(enabled&&a==='double'&&!x.used.double)return ask('Dvostruka nevolja','Želiš li baciti dodatnu kockicu i sabrati rezultat?',`<select id="double"><option value="yes">Da, dodatno bacanje</option><option value="no">Ne, normalno bacanje</option></select>`);
 sendRoll(choice);
};
function sendRoll(choice){const d=$('die'),d2=$('die2');d.classList.add('rolling');d.textContent='⚄';if(state?.race?.racers.find(x=>x.playerId===myId)?.character?.ability==='twoDice'){d2.hidden=false;d2.classList.add('rolling');d2.textContent='⚄';}setTimeout(()=>{d.classList.remove('rolling');d2.classList.remove('rolling');},550);emit('roll',choice);}


// Collection guide: all characters and their full ability descriptions.
$('collectionBtn').onclick=()=>{
 const cards=[...catalog].sort((a,b)=>a.name.localeCompare(b.name,'bs'));
 $('modalContent').innerHTML=`<div class="eyebrow">VODIČ KROZ LIKOVE</div><h3>Kolekcija sposobnosti</h3><p>Pregled svih ${cards.length} šampiona. Svaka kartica prikazuje tačan efekat sposobnosti u igri.</p><div class="collection-grid">${cards.map(c=>`<article class="collection-card"><div class="collection-art">${image(c)}</div><div class="collection-copy"><h4>${esc(c.name)}</h4><b>${esc(c.title)}</b><p>${esc(c.description)}</p></div></article>`).join('')}</div>`;
 $('modal').hidden=false;
};
