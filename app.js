
let DATA, cur=null, tab='discover', genre='All', grouped=false;
let prog=JSON.parse(localStorage.getItem('lu-prog')||'{}');
let dl=JSON.parse(localStorage.getItem('lu-dl')||'{}');
// cross-device progress sync (best-effort; localStorage stays the source of truth)
const SB={url:'https://rfuflyhitqwxtcecllya.supabase.co',key:'sb_publishable_uUA9BpF1dAitc6lVa0IqTg_TX6igiQ4',user:'maaz'};
let lastRemote=0;
function pushRemote(force){ if(!cur||!audio.duration)return; if(!force&&Date.now()-lastRemote<8000)return; lastRemote=Date.now();
  const p=prog[cur.slug]; if(!p)return;
  fetch(SB.url+'/rest/v1/listenup_progress?on_conflict=user_key,slug',{method:'POST',
    headers:{apikey:SB.key,Authorization:'Bearer '+SB.key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify({user_key:SB.user,slug:cur.slug,t:p.t,dur:p.dur,done:!!p.done,updated_at:new Date().toISOString()})}).catch(()=>{}); }
function pullRemote(){
  fetch(SB.url+'/rest/v1/listenup_progress?select=slug,t,dur,done,updated_at&user_key=eq.'+SB.user,{headers:{apikey:SB.key,Authorization:'Bearer '+SB.key}})
  .then(r=>r.ok?r.json():[]).then(rows=>{ let ch=false;
    rows.forEach(row=>{ const u=Date.parse(row.updated_at)||0, loc=prog[row.slug];
      if(!loc||u>(loc.u||0)){ prog[row.slug]={t:row.t||0,dur:row.dur||0,done:!!row.done,u}; ch=true; } });
    if(ch){ saveProg(); render(); } }).catch(()=>{}); }
const $=s=>document.querySelector(s);
const audio=$('#audio'), SPEEDS=[1,1.25,1.5,1.75,2]; let si=0;
const fmt=s=>{s=Math.max(0,Math.round(s||0));return (s/60|0)+':'+String(s%60).padStart(2,'0');};
const gcolor=g=>(DATA.genres.find(x=>x.name===g)||{}).color||'#0FA0A0';
const saveProg=()=>localStorage.setItem('lu-prog',JSON.stringify(prog));

// ---- theme ----
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('lu-theme',t);$('#theme').textContent=t==='dark'?'☀️':'🌙';
  document.querySelector('meta[name=theme-color]').content=t==='dark'?'#0C1719':'#0FA0A0';}
setTheme(localStorage.getItem('lu-theme')|| (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
$('#theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

async function load(){
  try{ DATA=await (await fetch('content.json',{cache:'no-cache'})).json(); }
  catch(e){ $('#lib').innerHTML='<p style="padding:2rem;color:var(--sub)">Could not load the library. Check your connection and reload.</p>'; return; }
  $('#tag').textContent=DATA.tagline;
  const gs=['All',...DATA.genres.map(g=>g.name)];
  $('#chips').innerHTML=gs.map((g,i)=>`<button class="chip${i===0?' on':''}" data-g="${g}" style="--cacc:${g==='All'?'#0FA0A0':gcolor(g)}">${g}</button>`).join('');
  document.querySelectorAll('#chips .chip').forEach(c=>c.onclick=()=>{genre=c.dataset.g;
    document.querySelectorAll('#chips .chip').forEach(x=>x.classList.toggle('on',x===c));render();});
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{tab=t.dataset.t;
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
    $('#chips').style.display=tab==='discover'?'':'none';$('#group').style.display=tab==='discover'?'':'none';render();});
  $('#group').onclick=()=>{grouped=!grouped;$('#group').classList.toggle('on',grouped);render();};
  render();
  pullRemote();   // merge in progress from other devices
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}

const isDone=b=>prog[b.slug]&&prog[b.slug].done;
const started=b=>prog[b.slug]&&prog[b.slug].t>15&&!prog[b.slug].done;

function renderContinue(){
  const inpr=DATA.books.filter(started);
  $('#cont').hidden=inpr.length===0;
  $('#contrail').innerHTML=inpr.map(b=>{const p=prog[b.slug];const pct=p.dur?Math.min(100,100*p.t/p.dur):0;
    const left=p.dur?Math.max(1,Math.round((p.dur-p.t)/60)):'';
    return `<div class="rc" data-slug="${b.slug}"><img src="covers/${b.slug}.png" alt="">
      <div style="flex:1;min-width:0"><div class="rt">${b.title}</div><div class="rl">${left} min left</div>
      <div class="pb"><span style="width:${pct}%"></span></div></div></div>`;}).join('');
  document.querySelectorAll('#contrail .rc').forEach(el=>el.onclick=()=>open(DATA.books.find(b=>b.slug===el.dataset.slug)));
}

function card(b){
  const cover=`covers/${b.slug}.png`;
  const p=prog[b.slug];
  const badge = b.status!=='ready' ? '<span class="badge">Soon</span>'
    : isDone(b) ? '<span class="badge done">✓ Done</span>' : `<span class="badge">${b.duration}</span>`;
  const pbar = (b.status==='ready'&&p&&p.dur&&!isDone(b)&&p.t>5)?`<div class="pbar"><span style="width:${100*p.t/p.dur}%"></span></div>`:'';
  return `<article class="bk ${b.status}" data-slug="${b.slug}">
    <div class="cw"><img src="${cover}" alt="${b.title}" onerror="this.style.opacity=0">${badge}
    ${b.status==='ready'?'<div class="play">▶</div>':''}${pbar}</div>
    <h3>${b.title}</h3><div class="au">${b.author}</div>
    <div class="blurb">${b.blurb||''}</div>
    <div class="mrow"><span>${b.genre}</span>${b.duration?`<span>${b.duration}</span>`:''}</div></article>`;
}

function render(){
  renderContinue();
  let books;
  if(tab==='finished'){ books=DATA.books.filter(isDone); $('#lib').innerHTML=books.length?books.map(card).join(''):'<p style="padding:1.5rem;color:var(--sub);grid-column:1/-1">Nothing finished yet. Your completed listens will land here.</p>'; bind(); return; }
  books=DATA.books.filter(b=>!isDone(b)).filter(b=>genre==='All'||b.genre===genre);
  if(grouped&&genre==='All'){
    let html='';
    DATA.genres.forEach(g=>{const gb=books.filter(b=>b.genre===g.name); if(gb.length){html+=`<div class="seclabel">${g.name}</div>`+gb.map(card).join('');}});
    $('#lib').innerHTML=html;
  } else $('#lib').innerHTML=books.map(card).join('');
  bind();
}
function bind(){ document.querySelectorAll('.bk').forEach(el=>el.onclick=()=>{const b=DATA.books.find(x=>x.slug===el.dataset.slug);
  b.status==='ready'?open(b):toast('“'+b.title+'” drops this week 🎧');}); }

// ---- player ----
function open(b){
  cur=b; audio.src=b.audio;
  $('#pcover').src=$('#mcover').src=`covers/${b.slug}.png`;
  $('#ptitle').textContent=$('#mtitle').textContent=b.title;
  $('#pauthor').textContent=$('#mauthor').textContent=b.author+(b.voice?' · read by '+b.voice:'');
  $('#pblurb').textContent=b.blurb;
  $('#player').hidden=false; $('#mini').hidden=false;
  updDl(); audio.playbackRate=SPEEDS[si];
  const resume=(prog[b.slug]&&!prog[b.slug].done)?prog[b.slug].t:0;
  const start=()=>{ if(resume>5) audio.currentTime=resume; audio.removeEventListener('loadedmetadata',start); };
  audio.addEventListener('loadedmetadata',start);
  audio.play().catch(()=>{}); startViz();
}
function setPlay(p){ $('#play').textContent=$('#mplay').textContent=p?'❚❚':'▶'; }
$('#play').onclick=$('#mplay').onclick=()=>{ audio.paused?audio.play().catch(()=>{}):audio.pause(); };
audio.onplay=()=>{setPlay(true);startViz();}; audio.onpause=()=>{setPlay(false);saveNow();pushRemote(true);stopViz();};
audio.ontimeupdate=()=>{ if(!audio.duration)return;
  $('#seek').value=1000*audio.currentTime/audio.duration;
  $('#cur').textContent=fmt(audio.currentTime); $('#dur').textContent=fmt(audio.duration);
  $('#mibar').style.width=(100*audio.currentTime/audio.duration)+'%';
  if(cur && (Date.now()-lastSave>4000)) saveNow(); };
audio.onended=()=>{ if(cur){prog[cur.slug]={t:0,dur:audio.duration,done:true,u:Date.now()};saveProg();pushRemote(true);render();toast('Finished ✓ moved to your Finished shelf');} };
let lastSave=0;
function saveNow(){ if(!cur||!audio.duration)return; lastSave=Date.now();
  const done=audio.currentTime>=audio.duration*0.97;
  prog[cur.slug]={t:done?0:audio.currentTime,dur:audio.duration,done,u:Date.now()};saveProg(); pushRemote(false); }
$('#seek').oninput=e=>{ if(audio.duration) audio.currentTime=e.target.value/1000*audio.duration; };
$('#back').onclick=()=>audio.currentTime=Math.max(0,audio.currentTime-15);
$('#fwd').onclick=()=>audio.currentTime=Math.min(audio.duration||1e9,audio.currentTime+15);
$('#speed').onclick=()=>{ si=(si+1)%SPEEDS.length; audio.playbackRate=SPEEDS[si]; $('#speed').textContent=SPEEDS[si]+'×'; };
function closePlayer(){ saveNow(); pushRemote(true); stopViz(); $('#player').hidden=true; render(); }
$('#close').onclick=closePlayer;
$('#player').onclick=e=>{ if(e.target===$('#player')) closePlayer(); };   // tap the dim backdrop
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#player').hidden) closePlayer(); });
$('#mini').onclick=e=>{ if(e.target.id!=='mplay') $('#player').hidden=false; };

// ---- live waveform ----
let AC, analyser, srcNode, rafId, bins;
function initViz(){ if(AC!==undefined) return; try{
  AC=new (window.AudioContext||window.webkitAudioContext)();
  srcNode=AC.createMediaElementSource(audio); analyser=AC.createAnalyser(); analyser.fftSize=256;
  srcNode.connect(analyser); analyser.connect(AC.destination); bins=new Uint8Array(analyser.frequencyBinCount);
 }catch(e){ AC=null; analyser=null; } }
function startViz(){ initViz(); if(AC&&AC.state==='suspended') AC.resume(); if(!rafId) vizLoop(); }
function stopViz(){ if(rafId){cancelAnimationFrame(rafId);rafId=null;} }
function vizLoop(){
  const cv=$('#viz'), ctx=cv.getContext('2d'), dpr=window.devicePixelRatio||1;
  cv.width=cv.clientWidth*dpr; cv.height=cv.clientHeight*dpr;
  const W=cv.width, H=cv.height, n=44, gap=3*dpr, bw=(W-(n-1)*gap)/n;
  function draw(){ rafId=requestAnimationFrame(draw); ctx.clearRect(0,0,W,H);
    let vals;
    if(analyser){ analyser.getByteFrequencyData(bins);
      vals=Array.from({length:n},(_,i)=>bins[Math.floor(i/n*bins.length*0.72)]/255); }
    else { const on=!audio.paused; vals=Array.from({length:n},(_,i)=>on?(0.18+0.55*Math.abs(Math.sin(Date.now()/220+i*0.5))):0.05); }
    const acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
    for(let i=0;i<n;i++){ const h=Math.max(H*0.07, vals[i]*H*0.92), x=i*(bw+gap), y=(H-h)/2, r=bw/2;
      ctx.fillStyle=acc; ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x,y,bw,h,r); else ctx.rect(x,y,bw,h); ctx.fill(); } }
  draw();
}

// ---- offline download ----
function updDl(){ const b=$('#dl'); if(dl[cur.slug]){b.textContent='✓ Saved offline';b.classList.add('done');}
  else{b.textContent='⤓ Download';b.classList.remove('done');} }
$('#dl').onclick=async()=>{ if(dl[cur.slug])return; $('#dl').textContent='Saving…';
  try{ const c=await caches.open('lu-audio'); await c.add(cur.audio);
    dl[cur.slug]=1; localStorage.setItem('lu-dl',JSON.stringify(dl)); updDl(); toast('Saved for offline ✓');
  }catch(e){ toast('Could not save'); updDl(); } };

let tid; function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tid);tid=setTimeout(()=>t.hidden=true,2600);}
window.addEventListener('beforeunload',saveNow);
let deferred; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false;});
$('#install').onclick=async()=>{ if(!deferred)return; deferred.prompt(); await deferred.userChoice; deferred=null; $('#install').hidden=true; };
load();
