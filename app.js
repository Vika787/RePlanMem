const replay = [
  [0,0,null,null,0,0,null],[1,4,null,null,0,0,null],[2,8,null,null,0,0,null],
  [3,12,5.2332,.4114,0,0,null],[4,16,4.1470,.2720,0,0,null],[5,20,3.6422,.2268,0,0,null],
  [6,24,2.9021,.1707,0,0,null],[7,28,2.5975,.1484,0,0,null],[8,32,2.4951,.1406,0,0,null],
  [9,36,3.5324,.2161,0,0,null],[10,40,8.0160,.8389,1,1,36],[11,44,8.3792,.8794,0,1,null],
  [12,48,6.5639,.6089,0,1,null],[13,52,4.4461,.3059,0,1,null],[14,56,4.6783,.3347,0,1,null],
  [15,60,4.6155,.3245,0,1,null],[16,64,4.6131,.3242,0,1,null],[17,68,4.9159,.3665,0,1,null],
  [18,72,5.7229,.4797,0,1,null],[19,76,7.4438,.7498,0,1,null],[20,80,9.6922,.9695,0,1,null],
  [21,84,10.8167,.9893,0,1,null],[22,88,10.1122,.9817,1,2,84],[23,92,8.1890,.8557,0,2,null]
].map(([query,step,score,percentile,event,occupancy,source])=>({query,step,score,percentile,event:Boolean(event),detectorTriggered:[10,11,20,21,22,23].includes(query),occupancy,source}));

const $ = selector => document.querySelector(selector);
const timeline = $("#timeline");
const viewer = $(".viewer");
const queryVideo = $("#query-video");
let current = 0;
let timer = null;

function phase(step){
  if(step < 40) return "Cue visible";
  if(step < 84) return "Object hidden";
  return "Action phase";
}

function explanation(row){
  if(row.percentile == null) return "The detector is collecting causal statistics before it can score plan revisions.";
  if(row.event) return `Event accepted. The visually distinct frame from step ${row.source} is written to memory.`;
  if(row.percentile >= .8) return "The score crosses the threshold, but visual clustering suppresses a redundant memory write.";
  return "Plan revision remains below the task-conditioned event threshold; memory is unchanged.";
}

function renderChart(){
  const svg = $("#score-chart"), left=42, right=944, top=13, bottom=108, width=right-left, height=bottom-top;
  const point = row => ({x:left + row.query/23*width, y:bottom - (row.percentile ?? 0)*height});
  const queryX = query => left + query/23*width;
  const valid = replay.filter(row=>row.percentile!=null);
  const path = valid.map((row,i)=>`${i?'L':'M'}${point(row).x.toFixed(1)},${point(row).y.toFixed(1)}`).join(' ');
  const area = `${path} L${point(valid.at(-1)).x.toFixed(1)},${bottom} L${point(valid[0]).x.toFixed(1)},${bottom} Z`;
  const hideBoundary=queryX(10), actionBoundary=queryX(21);
  let html=`
    <rect class="phase-band phase-cue" x="${left}" y="${top}" width="${hideBoundary-left}" height="${height}"/>
    <rect class="phase-band phase-hidden" x="${hideBoundary}" y="${top}" width="${actionBoundary-hideBoundary}" height="${height}"/>
    <rect class="phase-band phase-action" x="${actionBoundary}" y="${top}" width="${right-actionBoundary}" height="${height}"/>
    <text class="phase-label" x="${(left+hideBoundary)/2}" y="10">CUE VISIBLE</text>
    <text class="phase-label" x="${(hideBoundary+actionBoundary)/2}" y="10">OBJECT HIDDEN</text>
    <text class="phase-label" x="${(actionBoundary+right)/2}" y="10">ACTION</text>
    <line class="phase-boundary" x1="${hideBoundary}" y1="${top}" x2="${hideBoundary}" y2="${bottom}"/>
    <line class="phase-boundary" x1="${actionBoundary}" y1="${top}" x2="${actionBoundary}" y2="${bottom}"/>`;
  [0,.25,.5,.75,1].forEach(value=>{const y=bottom-value*height;html+=`<line class="chart-grid" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="chart-label" x="5" y="${y+3}">${value.toFixed(2)}</text>`});
  const thresholdY=bottom-.8*height;html+=`<line class="chart-threshold" x1="${left}" y1="${thresholdY}" x2="${right}" y2="${thresholdY}"/>`;
  html+=`<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>`;
  valid.forEach(row=>{const p=point(row);html+=`<circle class="chart-point${row.detectorTriggered?' triggered':''}" data-query="${row.query}" cx="${p.x}" cy="${p.y}" r="4"/>`;if(row.event)html+=`<circle class="chart-memory-ring" data-query="${row.query}" cx="${p.x}" cy="${p.y}" r="8"/>`});
  const x=point(replay[current]).x;html+=`<line id="chart-cursor" class="chart-cursor" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"/>`;
  svg.innerHTML=html;
  svg.querySelectorAll('[data-query]').forEach(node=>node.addEventListener('click',()=>setQuery(Number(node.dataset.query))));
  svg.onclick = event => {if(event.target.hasAttribute('data-query'))return;const rect=svg.getBoundingClientRect(), xIn=(event.clientX-rect.left)/rect.width*960;setQuery(Math.round(Math.max(0,Math.min(23,(xIn-left)/width*23))))};
}

function setQuery(index){
  current=Math.max(0,Math.min(23,index));
  const row=replay[current];
  timeline.value=current;
  if(queryVideo.duration){
    const targetTime=(row.step/94)*queryVideo.duration;
    if(typeof queryVideo.fastSeek==='function') queryVideo.fastSeek(targetTime);
    else queryVideo.currentTime=targetTime;
  }
  $("#frame-label").textContent=`query ${String(row.query).padStart(2,'0')} · step ${String(row.step).padStart(3,'0')}`;
  $("#query-output").textContent=`${String(row.query).padStart(2,'0')} / 23`;
  $("#query-value").textContent=row.query;
  $("#step-value").textContent=row.step;
  $("#raw-value").textContent=row.score==null?'—':row.score.toFixed(3);
  $("#percentile-value").textContent=row.percentile==null?'—':row.percentile.toFixed(3);
  $("#occupancy-value").textContent=`${row.occupancy} / 3`;
  $("#meter-fill").style.width=`${(row.percentile??0)*100}%`;
  $("#phase-label").textContent=phase(row.step);
  const decision=row.event?'memory write':row.percentile==null?'warming up':row.percentile>=.8?'threshold crossed':'no event';
  $("#decision-label").textContent=decision;
  $("#decision-label").style.color=row.event?'var(--orange)':'var(--accent)';
  $("#memory-one").classList.toggle('filled',row.occupancy>=1);
  $("#memory-two").classList.toggle('filled',row.occupancy>=2);
  $("#memory-three").classList.toggle('filled',row.occupancy>=3);
  $("#memory-one").classList.toggle('newly-written',row.event && row.occupancy===1);
  $("#memory-two").classList.toggle('newly-written',row.event && row.occupancy===2);
  $("#memory-three").classList.toggle('newly-written',row.event && row.occupancy===3);
  $("#event-explanation").textContent=explanation(row);
  renderChart();
}

function togglePlay(){
  if(timer){clearInterval(timer);timer=null;$("#play").textContent='Play';return;}
  $("#play").textContent='Pause';
  timer=setInterval(()=>{if(current>=23){togglePlay();return;}setQuery(current+1)},450);
}

timeline.addEventListener('input',()=>setQuery(Number(timeline.value)));
$("#prev").addEventListener('click',()=>setQuery(current-1));
$("#next").addEventListener('click',()=>setQuery(current+1));
$("#play").addEventListener('click',togglePlay);
viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();setQuery(current-1)}if(event.key==='ArrowRight'){event.preventDefault();setQuery(current+1)}if(event.key===' '){event.preventDefault();togglePlay()}});

const menu=$(".menu-button"), nav=$("#nav");
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}));
queryVideo.addEventListener('loadedmetadata',()=>setQuery(current));
setQuery(0);
