
let DATA, cur=null, tab='discover', genre='All', grouped=false, listView=localStorage.getItem('lu-view')==='list';
const COMPLEMENT={'Productivity':'Money','Money':'Psychology','Business':'Sales & Marketing','Sales & Marketing':'Psychology','Psychology':'Productivity','Health':'Productivity'};
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
const audio=$('#audio'), SPEEDS=[1,1.25,1.5,1.75,2];
let si=Math.min(SPEEDS.length-1,Math.max(0,parseInt(localStorage.getItem('lu-speed'),10)||0));
const fmt=s=>{s=Math.max(0,Math.round(s||0));return (s/60|0)+':'+String(s%60).padStart(2,'0');};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    document.querySelectorAll('.tab').forEach(x=>{const on=x===t;x.classList.toggle('on',on);x.setAttribute('aria-selected',on);});
    $('#chips').hidden=tab!=='discover'; $('#group').hidden=tab!=='discover'; render();});
  $('#group').onclick=()=>{grouped=!grouped;$('#group').classList.toggle('on',grouped);$('#group').setAttribute('aria-pressed',grouped);render();};
  function setViewBtn(){ $('#view').innerHTML=listView?'▦ Grid':'☰ List'; $('#view').classList.toggle('on',listView);
    $('#view').setAttribute('aria-pressed',listView); }
  $('#view').onclick=()=>{listView=!listView;localStorage.setItem('lu-view',listView?'list':'grid');setViewBtn();render();};
  setViewBtn();
  $('#speed').textContent=SPEEDS[si]+'×';
  applyOffline();
  if(offline) showDownloads(); else render();   // offline? land straight on Downloads, Netflix-style
  if(!offline) pullRemote();                    // merge in progress from other devices
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
    navigator.serviceWorker.ready.then(()=>reconcileDownloads()).catch(()=>{});
  } else { reconcileDownloads(); }
}

const isDone=b=>prog[b.slug]&&prog[b.slug].done;
const started=b=>prog[b.slug]&&prog[b.slug].t>15&&!prog[b.slug].done;

// ---- offline awareness ----
let offline=!navigator.onLine;
const playable=b=>b.status==='ready'&&(!offline||!!dl[b.slug]);
function applyOffline(){
  $('#offbar').hidden=!offline;
  $('#offtext').textContent=Object.keys(dl).length
    ? "You're offline. Showing episodes you've downloaded."
    : "You're offline, and nothing is downloaded yet. Connect to save episodes for later.";
}
function goOffline(){ if(offline) return; offline=true; applyOffline(); showDownloads(); toast('Offline. Showing your downloads.'); }
function goOnline(){ if(!offline) return; offline=false; applyOffline(); render(); toast('Back online'); }
window.addEventListener('offline',goOffline);
window.addEventListener('online',goOnline);
function showDownloads(){
  tab='downloads';
  document.querySelectorAll('.tab').forEach(x=>{const on=x.dataset.t==='downloads';
    x.classList.toggle('on',on); x.setAttribute('aria-selected',on);});
  $('#chips').hidden=true; $('#group').hidden=true;
  render();
}

function renderContinue(){
  const inpr=DATA.books.filter(b=>started(b)&&playable(b));
  $('#cont').hidden=inpr.length===0;
  $('#contrail').innerHTML=inpr.map(b=>{const p=prog[b.slug];const pct=p.dur?Math.min(100,100*p.t/p.dur):0;
    const left=p.dur?Math.max(1,Math.round((p.dur-p.t)/60)):'';
    return `<div class="rc" role="button" tabindex="0" aria-label="Resume ${esc(b.title)}, ${left} minutes left" data-slug="${b.slug}"><img src="covers/${b.slug}.png" alt="">
      <div style="flex:1;min-width:0"><div class="rt">${esc(b.title)}</div><div class="rl">${left} min left</div>
      <div class="pb"><span style="width:${pct}%"></span></div></div></div>`;}).join('');
  document.querySelectorAll('#contrail .rc').forEach(el=>{const go=()=>openBook(DATA.books.find(b=>b.slug===el.dataset.slug));
    el.onclick=go; el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } };});
}

function renderForYou(){
  const aff={};
  DATA.books.forEach(b=>{ const p=prog[b.slug]; if(!p)return; const w=p.done?2:(p.t>15?1:0);
    if(w){ aff[b.genre]=(aff[b.genre]||0)+w; const c=COMPLEMENT[b.genre]; if(c) aff[c]=(aff[c]||0)+w*0.6; } });
  const hasHist=Object.keys(aff).length>0;
  const pool=DATA.books.filter(b=>playable(b)&&!isDone(b)&&!started(b));
  const ranked = hasHist
    ? pool.map((b,i)=>({b,s:(aff[b.genre]||0)-i*0.001})).sort((x,y)=>y.s-x.s).map(x=>x.b)
    : pool;
  const pick=[], gc={};
  for(const b of ranked){ if(pick.length>=3) break; if((gc[b.genre]||0)>=2) continue; pick.push(b); gc[b.genre]=(gc[b.genre]||0)+1; }
  $('#foryou').hidden = pick.length===0;
  $('#furail').innerHTML = pick.map(b=>{
    const why = hasHist ? ((aff[b.genre]||0)>0 ? 'Because you like '+b.genre : 'A fresh pick') : b.genre;
    return `<div class="rc fu" role="button" tabindex="0" aria-label="Play ${esc(b.title)}. ${esc(why)}" data-slug="${b.slug}"><img src="covers/${b.slug}.png" alt="">
      <div style="flex:1;min-width:0"><div class="rt">${esc(b.title)}</div><div class="rl">${esc(why)}${b.duration?' · '+b.duration:''}</div></div></div>`;
  }).join('');
  document.querySelectorAll('#furail .rc').forEach(el=>{const go=()=>openBook(DATA.books.find(b=>b.slug===el.dataset.slug));
    el.onclick=go; el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } };});
}

function card(b){
  const cover=`covers/${b.slug}.png`;
  const p=prog[b.slug];
  const badge = b.status!=='ready' ? '<span class="badge">Soon</span>'
    : isDone(b) ? '<span class="badge done">✓ Done</span>' : `<span class="badge">${b.duration}</span>`;
  const pbar = (b.status==='ready'&&p&&p.dur&&!isDone(b)&&p.t>5)?`<div class="pbar"><span style="width:${100*p.t/p.dur}%"></span></div>`:'';
  const off = b.status==='ready' && !playable(b);   // offline and not downloaded
  const label = b.status!=='ready' ? `${b.title} by ${b.author}, coming soon`
    : off ? `${b.title} by ${b.author}, not downloaded, unavailable offline`
    : `Play ${b.title} by ${b.author}, ${b.duration}`;
  return `<article class="bk ${b.status}${off?' unavail':''}" data-slug="${b.slug}" role="button" tabindex="0" aria-label="${esc(label)}">
    <div class="cw"><img src="${cover}" alt="" decoding="async" onerror="this.style.opacity=0">${badge}
    ${playable(b)?'<div class="play" aria-hidden="true">▶</div>':''}${pbar}</div>
    <div class="bkmeta"><h3>${esc(b.title)}</h3><div class="au">${esc(b.author)}</div>
    <div class="blurb">${esc(b.blurb||'')}</div>
    <div class="mrow"><span>${esc(b.genre)}</span>${b.duration?`<span>${b.duration}</span>`:''}${dl[b.slug]?'<span class="dlpill">⤓ Saved</span>':''}</div></div></article>`;
}

function render(){
  renderContinue(); renderForYou();
  if(tab!=='discover'){ $('#cont').hidden=true; $('#foryou').hidden=true; }
  $('#lib').classList.toggle('list',listView);
  let books;
  if(tab==='downloads'){ books=DATA.books.filter(b=>dl[b.slug]);
    const empty = offline
      ? 'Nothing is downloaded. You will need an internet connection to save episodes for offline listening.'
      : 'Nothing downloaded yet. Open any episode and tap the Download button to save it here and listen offline, no internet needed.';
    $('#lib').innerHTML=books.length?books.map(card).join(''):'<p style="padding:1.5rem;color:var(--sub);grid-column:1/-1">'+empty+'</p>'; bind(); return; }
  if(tab==='finished'){ books=DATA.books.filter(isDone); $('#lib').innerHTML=books.length?books.map(card).join(''):'<p style="padding:1.5rem;color:var(--sub);grid-column:1/-1">Nothing finished yet. Your completed listens will land here.</p>'; bind(); return; }
  books=DATA.books.filter(b=>!isDone(b)).filter(b=>genre==='All'||b.genre===genre);
  books.sort((a,b)=>(a.status==='ready'?0:1)-(b.status==='ready'?0:1));   // ready first, "Soon" sink to the bottom
  if(grouped&&genre==='All'){
    let html='';
    DATA.genres.forEach(g=>{const gb=books.filter(b=>b.genre===g.name); if(gb.length){html+=`<div class="seclabel">${g.name}</div>`+gb.map(card).join('');}});
    $('#lib').innerHTML=html;
  } else $('#lib').innerHTML=books.map(card).join('');
  bind();
}
function bind(){ document.querySelectorAll('.bk').forEach(el=>{
  const go=()=>{const b=DATA.books.find(x=>x.slug===el.dataset.slug);
    if(b.status!=='ready'){ toast('“'+b.title+'” drops this week 🎧'); return; }
    if(!playable(b)){ toast('Not downloaded. Connect to the internet to stream it.'); return; }
    openBook(b);};
  el.onclick=go;
  el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } };
}); }

// ---- player ----
// The player is a modal sheet. On mobile the hardware / gesture Back must dismiss
// the sheet, NOT unload the PWA. We push a history entry when it opens and let
// popstate close it; closing via the UI just walks that entry back off the stack.
let sheetOpen=false, poppingBack=false, lastFocus=null;

function showSheet(){
  if(sheetOpen) return;
  sheetOpen=true; lastFocus=document.activeElement;
  $('#player').hidden=false;
  history.pushState({lu:'player'},'');
  document.body.style.overflow='hidden';          // don't scroll the library behind the sheet
  startViz();
  $('#close').focus({preventScroll:true});
}
function hideSheet(){
  sheetOpen=false;
  $('#player').hidden=true;
  document.body.style.overflow='';
  stopViz();
  if(lastFocus&&lastFocus.focus) lastFocus.focus({preventScroll:true});
}
function closePlayer(){
  saveNow(); pushRemote(true);
  if(sheetOpen && history.state && history.state.lu==='player'){
    poppingBack=true; history.back();             // popstate handler runs hideSheet
  } else { hideSheet(); }
  render();
}
window.addEventListener('popstate',()=>{
  if(sheetOpen){ hideSheet(); if(!poppingBack) render(); }
  poppingBack=false;
});

function openBook(b){
  if(!playable(b)){ toast('Not downloaded. Connect to the internet to stream it.'); return; }
  cur=b; confirmRemove=false; clearTimeout(confirmTid); audio.src=b.audio;
  $('#pcover').src=$('#mcover').src=`covers/${b.slug}.png`;
  $('#ptitle').textContent=$('#mtitle').textContent=b.title;
  $('#pauthor').textContent=$('#mauthor').textContent=b.author+(b.voice?' · read by '+b.voice:'');
  $('#pblurb').textContent=b.blurb;
  $('#mini').hidden=false;
  showSheet();
  updDl(); audio.playbackRate=SPEEDS[si];
  const resume=(prog[b.slug]&&!prog[b.slug].done)?prog[b.slug].t:0;
  const start=()=>{ if(resume>5) audio.currentTime=resume; audio.removeEventListener('loadedmetadata',start); };
  audio.addEventListener('loadedmetadata',start);
  audio.play().catch(()=>{});
  setMediaSession(b);
}

// lock-screen / headset / car-stereo controls: essential for gym and driving
function setMediaSession(b){
  if(!('mediaSession' in navigator)) return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:b.title, artist:b.author, album:'Listen Up',
      artwork:[192,512].map(s=>({src:`covers/${b.slug}.png`,sizes:s+'x'+s,type:'image/png'}))});
    const A=(k,fn)=>{ try{ navigator.mediaSession.setActionHandler(k,fn); }catch(e){} };
    A('play',()=>audio.play().catch(()=>{})); A('pause',()=>audio.pause());
    A('seekbackward',()=>skip(-15)); A('seekforward',()=>skip(15));
    A('previoustrack',()=>skip(-15)); A('nexttrack',()=>skip(15));
    A('seekto',e=>{ if(e.seekTime!=null&&audio.duration) audio.currentTime=e.seekTime; });
  }catch(e){}
}
const skip=d=>{ if(audio.duration||d<0) audio.currentTime=Math.min(audio.duration||1e9,Math.max(0,audio.currentTime+d)); };

function setPlay(p){ $('#play').textContent=$('#mplay').textContent=p?'❚❚':'▶';
  if('mediaSession' in navigator) navigator.mediaSession.playbackState=p?'playing':'paused'; }
$('#play').onclick=$('#mplay').onclick=()=>{ audio.paused?audio.play().catch(()=>{}):audio.pause(); };
audio.onplay=()=>{setPlay(true); if(sheetOpen)startViz();};
audio.onpause=()=>{setPlay(false);saveNow();pushRemote(true);stopViz();};
let seeking=false;
audio.ontimeupdate=()=>{ if(!audio.duration)return;
  if(!seeking) $('#seek').value=1000*audio.currentTime/audio.duration;
  $('#cur').textContent=fmt(audio.currentTime); $('#dur').textContent=fmt(audio.duration);
  $('#mibar').style.width=(100*audio.currentTime/audio.duration)+'%';
  if(cur && (Date.now()-lastSave>4000)) saveNow(); };
audio.onended=()=>{ if(cur){prog[cur.slug]={t:0,dur:audio.duration,done:true,u:Date.now()};saveProg();pushRemote(true);render();toast('Finished ✓ moved to your Finished shelf');} };
// a failed load used to do nothing at all; say so, and self-heal a bad download
audio.onerror=()=>{ if(!cur) return;
  if(dl[cur.slug]){ removeDownload(cur.slug,cur.audio).then(()=>{ updDl(); render();
    toast('That download was corrupted and has been cleared. Please download it again.'); }); }
  else toast(navigator.onLine?'Could not load this episode.':'You are offline and this episode is not downloaded.'); };
let lastSave=0;
function saveNow(){ if(!cur||!audio.duration)return; lastSave=Date.now();
  const done=audio.currentTime>=audio.duration*0.97;
  prog[cur.slug]={t:done?0:audio.currentTime,dur:audio.duration,done,u:Date.now()};saveProg(); pushRemote(false); }
// while a thumb is dragging the slider, ontimeupdate must not yank it back
const seekStart=()=>{seeking=true;}, seekEnd=()=>{seeking=false;};
$('#seek').addEventListener('pointerdown',seekStart); $('#seek').addEventListener('pointerup',seekEnd);
$('#seek').addEventListener('pointercancel',seekEnd); $('#seek').addEventListener('keydown',seekStart);
$('#seek').addEventListener('keyup',seekEnd);
$('#seek').oninput=e=>{ if(audio.duration){ seeking=true; audio.currentTime=e.target.value/1000*audio.duration; } };
$('#seek').onchange=seekEnd;
$('#back').onclick=()=>skip(-15);
$('#fwd').onclick=()=>skip(15);
$('#speed').onclick=()=>{ si=(si+1)%SPEEDS.length; audio.playbackRate=SPEEDS[si];
  $('#speed').textContent=SPEEDS[si]+'×'; localStorage.setItem('lu-speed',si); };
$('#close').onclick=closePlayer;
$('#player').onclick=e=>{ if(e.target===$('#player')) closePlayer(); };   // tap the dim backdrop
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&sheetOpen){ closePlayer(); return; }
  if(!cur) return;
  const typing=/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if(typing) return;
  if(e.key===' '&&sheetOpen){ e.preventDefault(); audio.paused?audio.play().catch(()=>{}):audio.pause(); }
  if(e.key==='ArrowLeft'&&sheetOpen) skip(-15);
  if(e.key==='ArrowRight'&&sheetOpen) skip(15);
});
$('#miopen').onclick=()=>{ if(cur) showSheet(); };   // reopening restarts the waveform

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
const saveDl=()=>localStorage.setItem('lu-dl',JSON.stringify(dl));
const AUDIO_CACHE='lu-audio';
let confirmRemove=false, confirmTid;

function updDl(){ const b=$('#dl'); if(!cur) return;
  b.disabled=false;
  if(confirmRemove){ b.textContent='Tap again to remove'; b.classList.add('done'); return; }
  if(dl[cur.slug]){ b.textContent='✓ Saved offline'; b.classList.add('done'); }
  else{ b.textContent='⤓ Download'; b.classList.remove('done'); } }

// Ask the browser not to evict our audio. Without this, mobile browsers silently
// purge the Cache API under storage pressure and downloads vanish.
async function askPersist(){
  try{ if(navigator.storage&&navigator.storage.persist){
    if(await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } }catch(e){}
  return false;
}

async function removeDownload(slug,url){
  try{ const c=await caches.open(AUDIO_CACHE); await c.delete(url,{ignoreVary:true}); }catch(e){}
  delete dl[slug]; saveDl();
}

async function downloadCurrent(){
  const b=$('#dl'), slug=cur.slug, url=cur.audio, title=cur.title;
  b.disabled=true; b.textContent='Saving…';
  await askPersist();
  try{
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const total=+(res.headers.get('Content-Length')||0);
    let blob;
    if(res.body&&res.body.getReader){                 // stream so we can show real progress
      const reader=res.body.getReader(); const chunks=[]; let got=0;
      for(;;){ const {done,value}=await reader.read(); if(done) break;
        chunks.push(value); got+=value.length;
        if(total) b.textContent='Saving '+Math.min(99,Math.round(got/total*100))+'%'; }
      blob=new Blob(chunks,{type:'audio/mpeg'});
    } else { blob=await res.blob(); }
    if(total&&Math.abs(blob.size-total)>1024) throw new Error('incomplete download');
    if(!blob.size) throw new Error('empty file');

    const c=await caches.open(AUDIO_CACHE);
    // store a clean, full 200 with the headers the SW needs to synthesise 206s
    await c.put(url,new Response(blob,{status:200,headers:{
      'Content-Type':'audio/mpeg','Content-Length':String(blob.size),'Accept-Ranges':'bytes'}}));

    const verify=await c.match(url,{ignoreVary:true});      // never trust, always verify
    if(!verify) throw new Error('verification failed');
    const vb=await verify.clone().blob();
    if(vb.size!==blob.size) throw new Error('verification size mismatch');

    dl[slug]={size:blob.size,at:Date.now()}; saveDl();
    toast('Saved offline ✓ '+fmtMB(blob.size));
    maybeWarnEviction();
  }catch(e){
    await removeDownload(slug,url);                          // never leave a half-download claiming success
    toast(navigator.onLine?('Could not save “'+title+'”. '+(e.message||'')):'Could not save. You are offline.');
  }
  b.disabled=false; updDl(); render();
}

const fmtMB=n=>(n/1048576).toFixed(0)+' MB';

// If the browser refuses durable storage, downloads can be evicted under pressure
// (and iOS Safari clears an un-installed site after ~7 idle days). Installing the
// PWA is the only real fix, so say so once, plainly.
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
async function maybeWarnEviction(){
  if(localStorage.getItem('lu-evict-warned')) return;
  let durable=false;
  try{ durable=navigator.storage&&navigator.storage.persisted?await navigator.storage.persisted():false; }catch(e){}
  if(durable||standalone()) return;
  localStorage.setItem('lu-evict-warned','1');
  setTimeout(()=>toast('Tip: install Listen Up to your home screen so your phone never deletes downloads.'),3000);
}

$('#dl').onclick=async()=>{
  if(!cur) return;
  if(dl[cur.slug]){
    if(!confirmRemove){                                      // two-tap guard: one stray tap used to delete it
      confirmRemove=true; updDl();
      clearTimeout(confirmTid); confirmTid=setTimeout(()=>{confirmRemove=false;updDl();},3200);
      return;
    }
    clearTimeout(confirmTid); confirmRemove=false;
    await removeDownload(cur.slug,cur.audio);
    updDl(); toast('Download removed'); render(); return;
  }
  await downloadCurrent();
};

// The Downloads tab must never claim something that is not actually on disk.
// Reconcile localStorage against the real cache, in both directions.
async function reconcileDownloads(){
  if(!('caches' in window)) return;
  let c; try{ c=await caches.open(AUDIO_CACHE); }catch(e){ return; }
  const keys=await c.keys();
  const have=new Set(keys.map(k=>new URL(k.url).pathname));
  let lost=0;
  for(const slug of Object.keys(dl)){
    const bk=DATA.books.find(x=>x.slug===slug);
    if(!bk){ delete dl[slug]; continue; }
    const path=new URL(bk.audio,location.href).pathname;
    if(!have.has(path)){ delete dl[slug]; lost++; }          // browser evicted it
  }
  // drop stray entries the old service worker auto-cached while streaming
  const wanted=new Set(Object.keys(dl).map(s=>{
    const bk=DATA.books.find(x=>x.slug===s); return bk?new URL(bk.audio,location.href).pathname:''; }));
  for(const k of keys) if(!wanted.has(new URL(k.url).pathname)) await c.delete(k,{ignoreVary:true});
  if(lost){ saveDl(); toast(lost+' download'+(lost>1?'s were':' was')+' cleared by your browser. Re-download to listen offline.'); }
  saveDl(); render();
}

let tid; function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tid);tid=setTimeout(()=>t.hidden=true,2600);}
window.addEventListener('beforeunload',saveNow);
let deferred; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false;});
$('#install').onclick=async()=>{ if(!deferred)return; deferred.prompt(); await deferred.userChoice; deferred=null; $('#install').hidden=true; };
load();
