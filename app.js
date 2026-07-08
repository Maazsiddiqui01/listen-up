
let DATA, cur=null, dl=JSON.parse(localStorage.getItem('lu-dl')||'{}');
const $=s=>document.querySelector(s);
const audio=$('#audio'), SPEEDS=[1,1.25,1.5,1.75,2]; let si=0;
const fmt=s=>{s=Math.max(0,s|0);return (s/60|0)+':'+String(s%60).padStart(2,'0');};
const genreColor=g=>(DATA.genres.find(x=>x.name===g)||{}).color||'#5866C4';

async function load(){
  DATA=await (await fetch('content.json')).json();
  $('#tag').textContent=DATA.tagline;
  const gs=['All',...DATA.genres.map(g=>g.name)];
  $('#chips').innerHTML=gs.map((g,i)=>`<button class="chip${i===0?' on':''}" data-g="${g}"
    style="--acc:${g==='All'?'#C6506E':genreColor(g)}">${g}</button>`).join('');
  document.querySelectorAll('#chips .chip').forEach(c=>c.onclick=()=>{
    document.querySelectorAll('#chips .chip').forEach(x=>x.classList.toggle('on',x===c));
    render(c.dataset.g);});
  render('All');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}

function render(genre){
  const list=DATA.books.filter(b=>genre==='All'||b.genre===genre);
  $('#lib').innerHTML=list.map(b=>{
    const cover=`covers/${b.slug}.png`;
    const badge=b.status==='ready'?(dl[b.slug]?'<span class="badge">⤓ Saved</span>':`<span class="badge">${b.duration}</span>`)
      :'<span class="badge">Soon</span>';
    return `<article class="bk ${b.status}" data-slug="${b.slug}">
      <div class="cw"><img loading="lazy" src="${cover}" alt="${b.title}">${badge}
      ${b.status==='ready'?'<div class="play">▶</div>':''}</div>
      <h3>${b.title}</h3><div class="au">${b.author}</div></article>`;
  }).join('');
  document.querySelectorAll('.bk').forEach(el=>el.onclick=()=>{
    const b=DATA.books.find(x=>x.slug===el.dataset.slug);
    if(b.status==='ready') open(b); else toast('“'+b.title+'” drops this week 🎧');
  });
}

function open(b){
  cur=b; audio.src=b.audio;
  $('#pcover').src=$('#mcover').src=`covers/${b.slug}.png`;
  $('#ptitle').textContent=$('#mtitle').textContent=b.title;
  $('#pauthor').textContent=$('#mauthor').textContent=b.author+' · '+(b.voice?('read by '+b.voice):'');
  $('#pblurb').textContent=b.blurb;
  $('#player').hidden=false; $('#mini').hidden=false;
  updDl(); audio.playbackRate=SPEEDS[si]; audio.play(); setPlay(true);
}
function setPlay(p){ $('#play').textContent=$('#mplay').textContent=p?'❚❚':'▶'; }
$('#play').onclick=$('#mplay').onclick=()=>{ audio.paused?audio.play():audio.pause(); };
audio.onplay=()=>setPlay(true); audio.onpause=()=>setPlay(false);
audio.ontimeupdate=()=>{ if(audio.duration){ $('#seek').value=1000*audio.currentTime/audio.duration;
  $('#cur').textContent=fmt(audio.currentTime); $('#dur').textContent=fmt(audio.duration);} };
$('#seek').oninput=e=>{ if(audio.duration) audio.currentTime=e.target.value/1000*audio.duration; };
$('#back').onclick=()=>audio.currentTime-=15;
$('#fwd').onclick=()=>audio.currentTime+=15;
$('#speed').onclick=()=>{ si=(si+1)%SPEEDS.length; audio.playbackRate=SPEEDS[si]; $('#speed').textContent=SPEEDS[si]+'×'; };
$('#close').onclick=()=>{ $('#player').hidden=true; };
$('#mini').onclick=e=>{ if(e.target.id!=='mplay') $('#player').hidden=false; };

function updDl(){ const b=$('#dl'); if(dl[cur.slug]){b.textContent='✓ Saved offline';b.classList.add('done');}
  else{b.textContent='⤓ Download';b.classList.remove('done');} }
$('#dl').onclick=async()=>{ if(dl[cur.slug])return; $('#dl').textContent='Saving…';
  try{ const c=await caches.open('lu-audio'); await c.add(cur.audio);
    dl[cur.slug]=1; localStorage.setItem('lu-dl',JSON.stringify(dl)); updDl(); toast('Saved for offline ✓');
  }catch(err){ toast('Could not save'); updDl(); } };

let tid; function toast(m){ const t=$('#toast'); t.textContent=m; t.hidden=false; clearTimeout(tid);
  tid=setTimeout(()=>t.hidden=true,2600); }

let deferred; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false;});
$('#install').onclick=async()=>{ if(!deferred)return; deferred.prompt(); await deferred.userChoice; deferred=null; $('#install').hidden=true; };
load();
