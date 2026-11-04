"use strict";
const intakeSlot="gdb.studio.intake.1";
const roles=[
 ["🎮","Indie game dev","I handle everything",Array.from({length:15},(_,i)=>i)],
 ["🎨","Illustrator","I create 2D assets",[2]],["🧊","3D artist","I model and texture",[3,4]],
 ["🦴","Technical animator","I rig and animate",[5,6]],["🕹️","Gameplay developer","I build and test mechanics",[0,8,9]],
 ["🎧","Sound designer","I make game audio",[7]],["🎬","Trailer editor","I capture and cut footage",[9,10]],
 ["🌋","Environment artist","I build landscapes and foliage",[3,13,14]],["💥","VFX artist","I create game effects",[13,8]],
 ["📣","Publishing & marketing","I prepare the launch",[11,12]],["🛠️","UGC creator","I build, test and publish worlds",[3,8,9,12]]
];
const typical=[["Notion"],["Obsidian"],["Photoshop","Illustrator"],["Blender"],["Substance 3D Painter"],["Blender"],["Blender"],["REAPER"],["Unreal Engine"],["OBS Studio"],["DaVinci Resolve"],["Photoshop"],["Steamworks"],["JangaFX EmberGen"],["Gaea"]];
const categoryLabels=["Design","Research","2D Sprites","3D Modeling","Texturing","Rigging","Animation","Audio","Mechanics","Playtests","Video Editing","Marketing","Publishing","VFX & simulation","Terrain & foliage"];
let intake,manifest=[],intakeIssues=[],intakeWorking=false,manifestPage=0;
function newIntake(){return {step:0,name:"",project:"",stages:[],apps:{},sources:{},advice:{}}}
function getIntake(){
 if(!intake){try{intake=JSON.parse(localStorage.getItem(intakeSlot))}catch{}}
 if(!intake||(intake.project&&!find(data.projects,intake.project)))intake=newIntake();
 return intake
}
function stash(){const {scannedThisVisit,...draft}=intake;localStorage.setItem(intakeSlot,JSON.stringify(draft))}
function toStep(n){intake.step=n;stash();render();window.scrollTo(0,0)}
function intakeNames(){return [...new Set(intake.stages.flatMap(i=>intake.apps[i]||[]))]}
function tasksFor(name){return intake.stages.filter(i=>intake.apps[i]?.includes(name))}
function appExtensions(name){
 const preset=setupStages.flatMap(s=>s[2]).find(([n])=>n===name)?.[1]||"";
 return (intake.sources[name]?.ext||preset).split(/[,;\s]+/).filter(Boolean).map(e=>"."+e.replace(/^\./,"").toLowerCase()).join(",")
}
function toolDraft(t){
 const p=project(),i=categoryLabels.indexOf(t.task),w=p.workflow?.find(w=>w.tool===t.id),j=setupStages.findIndex(([name])=>name===w?.stage);
 const stage=i>=0?i:j>=0?j:Math.max(0,setupStages.findIndex(s=>s[2].some(([name])=>name===t.name)));
 intake={...newIntake(),project:p.id,name:p.name,role:"",stages:[stage],apps:{[stage]:[t.name]},scoped:true,sources:{[t.name]:{folders:t.folders.slice(),ext:t.extensions,task:stage,install:t.installFolders?.[0]||""}}};
 manifest=[];intakeIssues=[];return intake.sources[t.name]
}
function folderIntake(t,folder){
 const src=toolDraft(t);if(folder&&!src.folders.some(p=>pathKey(p)===pathKey(folder)))src.folders.push(folder);
 intake.step=3;stash();go("setup")
}
function singleIntake(t,path){
 const existing=project().revisions.find(v=>v.path&&pathKey(v.path)===pathKey(path));
 if(existing){openRecord(existing.record,"History",{revision:existing.id});return}
 toolDraft(t);intake.single=path;intake.step=4;stash();go("setup")
}
function leaveIntake(){
 const t=project().tools.find(t=>t.name===intakeNames()[0]);localStorage.removeItem(intakeSlot);intake=null;manifest=[];intakeIssues=[];go("software",{tool:t?.id})
}
// The questions follow one lantern through separate projects, tools and version counters.
function welcomeSketches(){
 function figure(number,question,description,drawing){
   return `<figure class="desk-vignette"><figcaption><span aria-hidden="true">${number}</span>${question}</figcaption>
     <svg class="sheet-sketch" viewBox="0 0 310 98" role="img" aria-label="${description}" focusable="false">${drawing}</svg></figure>`
 }
 return `<div class="studio-sketches"><div class="sketch-column sketch-files">
 ${figure("01","Which game was this lantern for?","A lantern file between the Brinefall and Canopy Run prop folders.",`
   <g transform="rotate(-4 78 34)"><path class="folder-face" d="M9 23V14q0-3 4-3h30l6 7h77v36H9Z"/><path class="sheet-paper" d="m6 23 124-1-5 32H10Z"/><text x="17" y="43">Brinefall/Props</text></g>
   <g transform="rotate(3 220 37)"><path class="folder-face" d="M163 21V12h31l7 7h89v34H163Z"/><path class="sheet-paper" d="m158 24 136-1-4 31H163Z"/><text x="169" y="44">Canopy Run/Props</text></g>
   <path class="pencil-route" d="M143 70q-3-12-47-12m0 0 7-4m-7 4 7 3m48 11q13-12 56-10m0 0-6-4m6 4-7 3"/>
   <g transform="rotate(-2 150 84)"><rect class="sheet-paper" x="94" y="73" width="130" height="22" rx="3"/><circle class="ink-orange" cx="106" cy="84" r="3"/><text x="117" y="88">lantern.blend</text></g>`)}
 ${figure("02","Which version had the wider handle?","The Blender mesh goes from v001 to v007. Three handle experiments branch off v007.",`
   <text class="tool-caption" x="6" y="15">BLENDER</text><text x="73" y="15">v001 ··· v007</text>
   <g class="history-wires"><path d="M157 20v9H54q-6 0-6 6v6m109-12v12m0-12h98q5 0 5 6v6"/></g>
   <g class="study-tile"><rect x="11" y="41" width="77" height="48" rx="4"/><rect class="chosen-study" x="118" y="41" width="77" height="48" rx="4"/><rect x="222" y="41" width="77" height="48" rx="4"/></g>
   <path d="M38 68c-3-26 23-27 21 0m-24 1h28m72-1c-11-25 48-28 38 0m-36 1h33m74-1c-4-21 13-26 18-25 11 3 16 11 14 25m-34 1h37"/>
   <text x="25" y="85">v007.1</text><text x="134" y="85">v007.2</text><text x="239" y="85">v007.3</text>`)}
 ${figure("03","What was I testing in v007.3?","A pierced vent study beside an old artist note about testing the glow.",`
   <g transform="rotate(-6 59 46)"><path class="folder-face" d="m14 58 12-24 52-1 14 25Z"/><path d="M11 60h83v7H12Zm22-28 2-7h34l2 7"/>
   <path class="hatch" d="m31 43-3 9m13-9-3 9m13-9-3 9m13-9-3 9m13-9-3 9"/><text class="tool-caption" x="22" y="83">VENT STUDY</text></g>
   <path class="pencil-route" d="M98 54q11 7 27-3m-6-1 6 1-3 5"/>
   <g transform="rotate(3 210 46)"><path class="sketch-shadow" d="M135 19h150v66H135Z"/><path class="sheet-paper" d="m129 14 150-1v65l-150 2Z"/><path class="sketch-tape" d="m176 9 46-1 1 10-46 1Z"/>
   <text class="tool-caption" x="141" y="38">v007.3 · ARTIST NOTE</text><text class="pencil-note" x="140" y="62">Test the vent glow.</text></g>`)}
 </div><div class="sketch-column sketch-handoffs">
 ${figure("04","Where’s the mesh I sent to Painter?","The v007.2 Blender model on D drive leads to the first Substance Painter file on E drive.",`
   <g transform="rotate(-2 103 22)"><rect class="sheet-paper" x="6" y="8" width="228" height="25" rx="3"/><circle class="ink-orange" cx="17" cy="21" r="3"/><text x="27" y="25">D:/Models/lantern_v007.2.blend</text></g>
   <path class="history-wires handoff" d="M42 39v17q0 7 9 7h21m-5-5 6 5-6 5"/>
   <g transform="rotate(1 177 70)"><rect class="paint-card" x="80" y="53" width="220" height="31" rx="4"/><circle class="ink-green" cx="93" cy="69" r="3"/><text x="104" y="73">E:/Painter/lantern_v001.spp</text></g>
   <g transform="translate(48 -6) rotate(-8 245 30)"><path class="folder-face" d="m213 26 38-11 3 6-39 11Z"/><path class="sheet-paper" d="m215 26-8 3 1 6 9-4Z"/><path class="brush-ink" d="M208 29q-12-3-17 13 13 1 18-8Z"/></g>`)}
 ${figure("05","Did I paint this before I sculpted the dents?","Substance Painter’s brass texture file and ZBrush’s dent sculpt both start at v001.",`
   <g transform="rotate(-3 51 28)"><path class="folder-face" d="M17 34 27 10l43 2 12 23Z"/><path class="pencil-faint" d="m29 29 9-11m2 11 8-11m3 11 8-10"/><path d="m17 35 65 1"/></g>
   <text class="tool-caption" x="99" y="19">SUBSTANCE PAINTER</text><text x="99" y="36">lantern_v001.spp</text>
   <path class="pencil-faint" d="m9 46 271-1"/>
   <g transform="translate(0 45) rotate(2 50 26)"><path class="clay-face" d="m16 35 11-23 42-1 13 25Z"/><path d="M30 22q1 8 7 3m11-7q0 7 6 4m7 4q-1 6 5 5m-51 7h69"/></g>
   <text class="tool-caption" x="99" y="66">ZBRUSH</text><text x="99" y="83">lantern_v001.zpr</text>
   <path class="pencil-route" d="M239 26q29 5 26 22t-23 26m5-6-6 6 8 1"/>`)}
 ${figure("06","Which FBX actually made it into the build?","Two exports sit next to the lantern in the game viewport. The arrow starts at v008.",`
   <g transform="rotate(-4 70 26)"><path class="folder-face" d="M9 12h103l12 12v13H9Z"/><text x="15" y="30">lantern_v007.fbx</text></g>
   <g transform="rotate(2 75 55)"><path class="sheet-paper" d="M16 40h108l12 12v19H16Z"/><path d="M124 40v12h12"/><text x="22" y="61">lantern_v008.fbx</text></g>
   <path class="history-wires handoff" d="M139 55q13-13 31-8m-5-6 6 6-9 3"/>
   <g transform="rotate(2 233 47)"><rect class="sheet-paper" x="181" y="8" width="111" height="63" rx="4"/><rect class="viewport" x="187" y="14" width="99" height="49" rx="2"/>
   <path class="screen-lines" d="m188 54 23-14 11 6m28-1 12-12 23 14m-98 11h99"/><path d="m229 72-3 8h21l-3-8m-26 10h36"/>
   <path class="lantern-glass" d="m226 39 17 0 2 17-21 1Z"/><path d="m222 39 5-6h14l5 6Zm0 18h25m-20-24c-8-19 21-21 16-1m-14 10 11 11m0-12-11 12"/></g><text class="tool-caption" x="204" y="96">IN THE BUILD</text>`)}
 </div></div>`
}
function studioIntake(){
 getIntake();if(intake.project)locationState.project=intake.project;const s=intake,step=s.step,labels=["Game","Disciplines","Software","Folders","Assets"];
 const out=main;out.classList.toggle("studio-arrival",out.dataset.chapter!==String(step));out.dataset.chapter=String(step);
 const controls=`<header class="guide-toolbar"><span class="studio-brand">${graphMark()} Game Dev Brain</span><div class="actions"><label class="launch-switch"><input type="checkbox" id="guideOnLaunch" ${localStorage.getItem(guideOnLaunch)!=="off"?"checked":""}> Guide me on launch</label>${localStorage.getItem(guideOnLaunch)==="off"?btn("Open library",()=>go("home")):""}${btn("Ask the assistant",chatWithStudioAssistant)}</div></header>`;
 out.innerHTML=controls+`<div class="journey"><div class="journey-stops">${labels.map((n,i)=>`<span class="${i===step?"now":i<step?"past":""}"><b>${i<step?"✓":i+1}</b> ${n}</span>`).join("")}</div><div class="journey-meter" role="progressbar" aria-label="Project setup" aria-valuenow="${step*25}" aria-valuemin="0" aria-valuemax="100"><i style="--progress:${step*25}%"></i></div></div><section id="studioChat"></section>`;
 $("#guideOnLaunch").onchange=e=>{localStorage.setItem(guideOnLaunch,e.target.checked?"on":"off");render()};animateMeter();
 const box=$("#studioChat");
 if(!step){
   box.innerHTML=`<div class="chat-welcome"><div class="welcome-copy"><small class="welcome-label">${graphMark()} Studio setup</small><h1>Hey there! What <em class="welcome-game">game</em> are you working on?</h1><form id="gameChat"><input id="gameName" autocomplete="off" aria-label="Game name" placeholder="Type your game’s name…" value="${esc(s.name)}" required maxlength="180"><button class="primary" aria-label="Send game name">Send →</button></form><small>Give your working files, experiments and exports a shared history.</small></div>${welcomeSketches()}<aside class="return-note"><svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><path d="m6 9 29-2 2 30-29 2zM7 16l28-2M13 5v7m13-8v7m-12 9 4-.4m4-.3 5-.4m-12 7 4-.4m3-.2 5-.4"/><path d="m22 33 3 2 6-8"/></svg><span><small>Six weeks later</small>Where did I leave off?</span></aside></div>`;
   $("#gameChat").onsubmit=async e=>{e.preventDefault();const name=need("gameName"),matches=data.projects.filter(p=>p.name.toLowerCase()===name.toLowerCase());if(matches.length>1){toast("More than one project uses this name. Use a unique project name.");return}
    const p=matches[0],projectId=p?.id||id();
    try{lastCommand="create project";if(!p)await change((_,state)=>state.projects.push({id:projectId,name,sections:[],classes:[],records:[],tools:[],revisions:[]}));
    s.name=name;s.project=projectId;s.created=!p;locationState.project=projectId;
    if(p){s.stages=activeDisciplines(p).map(name=>categoryLabels.indexOf(name));s.apps=Object.fromEntries(s.stages.map(i=>[i,disciplineTools(p,i)]))}
    toStep(1)}catch(err){toast(err.message)}
   };return
 }
 const titles=["","Which parts of game development do you handle?","Which tools do you actually use?","Where do you keep this game’s work?","Does this look like your asset library?"];
 box.innerHTML=`<div class="intake-heading"><span class="chip receipt" role="status">${esc(s.name)} ${step===1?(s.created?"· Project created ✓":"· Project opened ✓"):""}</span><h1>${titles[step]}</h1></div><div id="intakePanel"></div>`;
 const panel=$("#intakePanel");
 if(step===1){
   panel.innerHTML=`<p>Start with a role, then adjust the disciplines that apply.</p><div class="role-grid">${roles.map(([icon,title,sub,stages])=>`<button class="role-card ${s.role===title?"chosen":""}" data-a="${bind(()=>{s.role=title;s.stages=stages.slice();stash();render()})}"><strong>${icon} ${esc(title)}</strong><small>${esc(sub)}</small></button>`).join("")}</div><div class="bar">${setupStages.map(([stage],i)=>toggleChip(stage,s.stages.includes(i),()=>{s.role="";s.stages=s.stages.includes(i)?s.stages.filter(n=>n!==i):[...s.stages,i];stash();render()})).join("")}</div><div class="actions">${btn("Back to game",()=>{const currentName=s.name;intake=newIntake();intake.name=currentName;manifest=[];toStep(0)})}${btn("Choose software →",()=>{if(!s.stages.length)throw Error("Select at least one discipline.");for(const i of s.stages)if(!s.apps[i])s.apps[i]=typical[i].slice();toStep(2)},"primary")}</div>`;
 }else if(step===2){
   panel.innerHTML=`<p>Common tools are checked. Keep as many as you use for each selected discipline.</p>${s.stages.map(i=>`<div class="fieldbox"><h3>${esc(setupStages[i][0])}</h3><div class="bar">${[...new Set([...setupStages[i][2].map(x=>x[0]),...(s.apps[i]||[])])].map(n=>`<button class="${s.apps[i].includes(n)?"chosen":""}" aria-pressed="${s.apps[i].includes(n)}" data-a="${bind(()=>{s.apps[i]=s.apps[i].includes(n)?s.apps[i].filter(t=>t!==n):[...s.apps[i],n];stash();render()})}">${toolIcon(n)} ${esc(n)} ${s.apps[i].includes(n)?"✓":""}</button>`).join("")}${btn("+ Other tool",()=>modal("Add software",input("toolName","Tool name","","text",true)+input("toolExt","File extensions (comma-separated)","","text",true),async()=>{const n=need("toolName");s.sources[n]={...s.sources[n],ext:need("toolExt")};s.apps[i]=[...new Set([...s.apps[i],n])];stash();render()}))}</div></div>`).join("")}<div class="actions">${btn("Back",()=>toStep(1))}${btn("Connect folders →",()=>{if(!intakeNames().length)throw Error("Select a tool first.");toStep(3)},"primary")}</div>`
 }else if(step===3){
   panel.innerHTML=`<p>Start with one working folder. Add more whenever you need them.</p>${intakeNames().map((n,j)=>{
    const t=project().tools.find(t=>t.name===n),tasks=tasksFor(n);
    const src=s.sources[n]||={};src.folders??=t?.folders?.slice()||[];src.install??=t?.installFolders?.[0]||"";
    src.formats??=Object.fromEntries((t?.folders||[]).map(f=>[pathKey(f),t.folderFormats?.[pathKey(f)]??extensions(t.extensions)]));
    src.ext??=t?.extensions;if(!s.scoped&&!tasks.includes(src.task))src.task=tasks[0];
    return `<details class="fieldbox tool-folder" ${j===0||src.expanded?"open":""} data-folder-card="${j}"><summary>${toolIcon(n)} ${esc(n)} <small>${esc(src.folders.length?src.folders.length+" linked":"Choose folders")}</small></summary>${select("work"+j,"What are you doing in this tool?",(s.scoped?categoryLabels.map((_,i)=>i):tasks).map(i=>opt(String(i),categoryLabels[i],String(src.task))).join(""))}
    <label for="dirs${j}">Project folders · one per line</label><textarea id="dirs${j}">${esc(src.folders.join("\n"))}</textarea>${btn("Browse project folder",async()=>{const r=await post("pick",{kind:"folder"});if(r.path){src.folders=[...new Set([...src.folders,r.path])];stash();render()}})}
    <div id="folderFormats${j}"></div><details ${src.install?"open":""}><summary>Install location (optional)</summary>${input("install"+j,"Application folder",src.install)}${btn("Browse install folder",async()=>{const r=await post("pick",{kind:"folder"});if(r.path){src.install=r.path;stash();render()}})}<small>Asset discovery scans the project folders above.</small></details></details>`
   }).join("")}${hasKey?`<label class="meta-scan"><input id="autoMeta" type="checkbox" ${s.autoMeta!==false?"checked":""}> Ask Meta to organize filenames, nearby folder names and tasks after scanning</label>`:""}<div class="actions">${s.scoped?btn("Cancel",leaveIntake):btn("Back",()=>toStep(2))}${btn("Find my assets →",connectIntake,"primary")}</div>`;
   if($("#autoMeta"))$("#autoMeta").onchange=e=>{s.autoMeta=e.target.checked;stash()};intakeNames().forEach((n,j)=>{const src=s.sources[n];const drawFormats=()=>folderTypeOptions($("#folderFormats"+j),n,src);drawFormats();$(`[data-folder-card="${j}"]`).ontoggle=e=>{src.expanded=e.target.open;stash()};$("#work"+j).onchange=e=>{src.task=Number(e.target.value);stash()};$("#dirs"+j).oninput=e=>{src.folders=e.target.value.split(/\r?\n/).map(t=>t.trim().replace(/^"|"$/g,"")).filter(Boolean);drawFormats();stash()};$("#install"+j).oninput=e=>{src.install=e.target.value.trim();stash()}})
 }else {renderManifest(panel);if(!manifest.length&&!intakeWorking&&!intake.scannedThisVisit){intake.scannedThisVisit=true;queueMicrotask(()=>discoverIntake().catch(e=>toast(e.message)))}}
 const action=panel.querySelector(".actions:last-child .primary");if(action){const hint=document.createElement("small");hint.className="studio-cue";hint.textContent=["","Pick one role to start.","Keep only tools you use.","A single folder is enough.","You can edit these choices later."][step];action.after(hint)}
}
function toggleChip(name,active,fn){return `<button type="button" aria-pressed="${active}" class="${active?"chosen":""}" data-a="${bind(fn)}">${active?"☑":"☐"} ${esc(name)}</button>`}
function ensureSection(p,name){
 let sec=p.sections.find(s=>s.name.toLowerCase()===name.toLowerCase());if(!sec){sec={id:id(),name,kind:"Collection",fields:[]};p.sections.push(sec)}return sec
}
async function connectIntake(){
 await change(p=>{
  p.disciplines=[...new Set([...(intake.scoped?activeDisciplines(p):[]),...intake.stages.map(i=>categoryLabels[i]),...intakeNames().map(n=>categoryLabels[intake.sources[n].task])])].filter(Boolean);
  for(const name of p.disciplines)ensureSection(p,name);
  if(!intake.scoped)p.workflow=(p.workflow||[]).filter(w=>!setupStages.some(s=>s[0]===w.stage));
  for(const n of intakeNames()){
   const src=intake.sources[n];let tool=p.tools.find(t=>t.name.toLowerCase()===n.toLowerCase());if(!tool){tool={id:id(),name:n,extensions:appExtensions(n),folders:[]};p.tools.push(tool)}
   tool.extensions=extensions([tool.extensions,...Object.values(src.formats||{}).flat()].join(" ")).join(",");
   tool.folders=[...new Set(src.folders)];tool.folderFormats=Object.fromEntries(tool.folders.map(f=>{const list=src.formats[pathKey(f)];if(!list?.length)throw Error("Choose a file type for "+f);return [pathKey(f),list]}));tool.installFolders=src.install?[...new Set([src.install,...(tool.installFolders||[]).slice(1)])]:[];tool.task=categoryLabels[src.task];tool.disciplines=[...new Set([...(intake.scoped?tool.disciplines||[]:[]),...tasksFor(n).map(i=>categoryLabels[i]),tool.task])];
   for(const i of new Set([...tasksFor(n),src.task])){const sec=ensureSection(p,categoryLabels[i]);p.workflow=p.workflow||[];if(!p.workflow.some(w=>w.stage===setupStages[i][0]&&w.tool===tool.id))p.workflow.push({stage:setupStages[i][0],tool:tool.id,section:sec.id})}
  }
 });manifest=[];intakeIssues=[];intake.scannedThisVisit=true;toStep(4);await discoverIntake();if(hasKey&&intake?.autoMeta!==false&&manifest.length)await analyzeGroups()
}
function seriesInfo(path,defaultTask){
 const parts=path.replaceAll("\\","/").split("/"),name=parts.pop(),ext=fileExt(name),base=ext?name.slice(0,-ext.length):name;
 const ver=base.match(/(?:^|[_. -])(v\d+(?:\.\d+)*)(?=$|[_. -])/i);
 const folder=parts.filter(n=>n&&!/^(?:v?\d+(?:\.\d+)*)(?:$|[_. -])/i.test(n)&&!/^(?:exports?|source|rigging|modeling|blender|fbx)$/i.test(n)).at(-1)||"";
 const milestone=!ver&&base.match(/^(.+?)[_. -]+(start|final)$/i);
 const stem=(ver?base.slice(0,ver.index):milestone?milestone[1]:base).trim()||folder||base;
 const words=stem.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").trim();
 const scope=words+" "+parts.slice(-3).join(" ").replace(/[_-]/g," ");
 const task=/\brig(?:ging)?\b/i.test(words)?"Rigging":/\b(?:mesh|model(?:ing)?)\b/i.test(words)?"3D Modeling":/\b(?:texture|texturing)\b/i.test(words)?"Texturing":/\brigging\b/i.test(scope)?"Rigging":/\bmodel(?:l)?ing\b/i.test(scope)?"3D Modeling":defaultTask;
 const explicit=/\b(?:rig|rigging|mesh|model|modeling|texturing|texture)\b/i.test(scope),classification=/\benem(?:y|ies)(?: npcs?)?\b/i.test(scope)?"Enemy NPC":/\bfriendly npcs?\b/i.test(scope)?"Friendly NPC":/\bfoliage\b/i.test(scope)?"Foliage":"";
 const asset=words.replace(/\s+\b(rig(?:ging)?|mesh|model(?:ing)?|texture|sculpt)\b.*$/i,"").trim()||words;
 return {asset,explicit,classification,label:ver?.[1]||(milestone?/^start$/i.test(milestone[2])?"Start":"Final":"Initial"),task,detail:ver?base.slice(ver.index+ver[0].length).replace(/[_-]+/g," ").trim():""}
}
const badgeList=["🪨","🧩","🎨","🌿","🛠️","🪶","🦊","🧊"];
function freshBadge(){return badgeList[Math.floor(Math.random()*badgeList.length)]}
async function discoverIntake(){
 if(intakeWorking)return;intakeWorking=true;render();
 try{
 const p=project(),groups=new Map(),tracked=new Set(p.revisions.filter(v=>v.path).map(v=>pathKey(v.path))),seen=new Set();intakeIssues=[];
 for(const n of intakeNames()){
   const t=p.tools.find(t=>t.name===n);if(!t||(!intake.single&&!t.folders.length))continue;
   const result=intake.single?{files:[intake.single],issues:[]}:await post("scan",{project:p.id,tool:t.id});intakeIssues.push(...result.issues);
   const parsed=result.files.map(path=>({path,...seriesInfo(path,t.task||"3D Modeling")})),knownTasks=new Map();
   for(const f of parsed){if(!f.explicit)continue;const k=f.asset.toLowerCase();if(!knownTasks.has(k))knownTasks.set(k,new Set());knownTasks.get(k).add(f.task)}
   for(const info of parsed){const path=info.path;
     const key=pathKey(path);if(tracked.has(key)||seen.has(key))continue;seen.add(key);
     const matches=knownTasks.get(info.asset.toLowerCase());if(!info.explicit&&matches?.size===1)info.task=[...matches][0];
     const format=fileExt(path),token=JSON.stringify([t.id,info.asset.toLowerCase(),info.task,format]);
     if(!groups.has(token)){const prior=p.records.find(r=>r.name.toLowerCase()===info.asset.toLowerCase());
       groups.set(token,{id:id(),format,asset:prior?.name||info.asset,discipline:info.task,tool:t.id,selected:true,type:prior?.assetType||(/NPC$/.test(info.classification)?"Character":""),classification:classPath(prior?.cls)||info.classification,emoji:prior?.emoji||freshBadge(),cover:prior?.cover||"",note:"",files:[],notes:{},token,...intake.advice[token]})}
     groups.get(token).files.push({path,...info})
   }
 }
 manifestPage=0;manifest=[...groups.values()];for(const g of manifest)g.files.sort((a,b)=>versionCompare(a,b)||a.path.localeCompare(b.path));
 }finally{intakeWorking=false;if(locationState.view==="setup")render()}
}
function saveGroup(g){
 const {files,token,id,...rest}=g;intake.advice[token]=rest;stash()
}
async function analyzeGroups(){
 if(!hasKey){keyForm();return}if(intakeWorking)return;intakeWorking=true;render();
 const p=project();try{
 for(let start=0;start<manifest.length;start+=6){
   const batch=manifest.slice(start,start+6);
   const groups=batch.map(g=>({id:g.id,asset:g.asset,software:toolName(g.tool),task:g.discipline,allowed:categoryLabels,
    files:g.files.slice(0,18).map(f=>f.path.replaceAll("\\","/").split("/").slice(-3).join("/"))}));
   const result=await post("ai",{project:p.id,mode:"organize",groups});
   for(const s of result.suggestions){const g=batch.find(g=>g.id===s.id);if(g){g.asset=s.asset;g.discipline=s.discipline;g.type=s.type||g.type;g.classification=s.classification||g.classification;saveGroup(g)}}
 }
 toast("Meta suggestions ready to review.")}catch(err){toast(err.message)}finally{intakeWorking=false;render()}
}
function sourceOptions(g){const p=project(),r=p.records.find(r=>r.name.toLowerCase()===g.asset.trim().toLowerCase());return opt("","Independent / unknown",g.parent)+p.revisions.filter(v=>v.record===r?.id).map(v=>opt(v.id,revisionLabel(v)+" · "+v.path.split(/[\\/]/).at(-1),g.parent)).join("")}
function identityForm(r){
 const p=project(),current=classPath(r.cls);
 modal("Classify "+r.name,input("identityClass","Asset class path",current)+`<small>Nest classes with /, for example NPCs / NPC Wildlife / Neutral.</small>`+`<datalist id="knownClasses">${[...new Set(["Enemy NPC","Friendly NPC","Hero","Prop","Foliage",...p.classes.filter(c=>c.section===r.section).map(c=>classPath(c.id))])].map(n=>opt(n,n,"")).join("")}</datalist>`+input("identityType","Asset type",r.assetType)+input("identityEmoji","Emoji",r.emoji||freshBadge())+previewPicker(r.cover),async()=>{
  const cover=await preview(r.cover),classification=val("identityClass");await change(p=>{const x=find(p.records,r.id);x.assetType=val("identityType");x.emoji=val("identityEmoji");x.cover=cover;x.cls="";assetClass(p,x,classification);x.intakeReviewed=true});render();toast("Asset identity saved.")
 });$("#identityClass").setAttribute("list","knownClasses")
}
const pendingCovers=new WeakMap();
function renderManifest(panel){
 if(intakeWorking){panel.innerHTML=`<div class="panel">Organizing your project files…</div>`;return}
 const start=manifestPage*4,visible=manifest.slice(start,start+4),p=project(),toolsUsed=new Set(intakeNames());
 const unfinished=!intake.single&&p.records.find(r=>r.emoji&&!r.cls&&!r.intakeReviewed&&p.revisions.some(v=>v.record===r.id&&toolsUsed.has(toolName(v.tool))));
 panel.innerHTML=`<div class="panel"><p>One card per suggested series. Review the asset once for all its versions. Matching asset names share a history across disciplines.</p>${intakeIssues.map(i=>`<p class="error">${esc(i)}</p>`).join("")}<div class="bar">${intake.single?"":btn("Scan folders",discoverIntake)}${manifest.length?aiBtn("Ask Meta to organize",analyzeGroups):""}</div>${manifest.length?"<small>Meta receives sample filenames, nearby folder names, tasks and existing asset names when you ask.</small>":empty("No new files listed. Scan to resume a review, connect another folder, or open your project.")}</div>
 ${unfinished?`<div class="panel spread"><div><small>Already tracked</small><h3>${esc(unfinished.emoji)} ${esc(unfinished.name)}</h3><span>How do you classify this asset in your game?</span></div>${btn("Classify "+unfinished.name,()=>identityForm(unfinished))}</div>`:""}
 ${manifest.length>4?`<div class="spread"><strong>Series ${start+1}–${start+visible.length} of ${manifest.length}</strong><div class="bar">${start?btn("← Previous",()=>{manifestPage--;render()}):""}${start+4<manifest.length?btn("Next series →",()=>{manifestPage++;render()}):""}</div></div>`:""}
 ${visible.map((g,offset)=>{const i=start+offset;return `<div class="panel series-card"><div class="spread"><h2>${esc(g.emoji)} ${esc(g.asset)}</h2><label><input type="checkbox" class="inline" data-keep="${i}" ${g.selected?"checked":""}> Track ${g.files.length} file${g.files.length===1?"":"s"}</label></div><small>${toolIcon(toolName(g.tool))} ${esc(toolName(g.tool))} · ${esc(g.discipline)} · ${esc(g.format)}</small><div class="series-fields">${input("asset"+i,"Asset name",g.asset)}${select("disc"+i,"Task / branch",categoryLabels.map(d=>opt(d,d,g.discipline)).join(""))}${input("class"+i,"Asset class path",g.classification)}</div><div class="series-fields">${input("type"+i,"Asset type",g.type)}${input("emoji"+i,"Image or emoji",g.emoji)}${pictureField("cover"+i,g.cover)}</div>
 ${input("note"+i,g.files.length===1?"What did you create or change in this file?":"What did you create or change? (series note)",g.note)}<details><summary>Software & source handoff</summary>${select("groupTool"+i,"Created in",opts(project().tools,g.tool))}${select("from"+i,"Source version / handoff (optional)",sourceOptions(g))}</details><details><summary>Files and individual revision notes</summary>${g.files.map((f,j)=>`<div class="row"><div class="grow"><b>${esc(f.label)}</b> ${esc(f.path.split(/[\\/]/).at(-1))}</div><input aria-label="Quick revision note" data-file="${i},${j}" placeholder="Quick revision note" value="${esc(g.notes[f.path]||"")}"></div>`).join("")}</details></div>`}).join("")}
 <datalist id="commonClasses">${[...new Set(["Enemy NPC","Friendly NPC","Hero","Foliage","Building","Prop",...project().classes.map(c=>classPath(c.id))])].map(n=>opt(n,n,"")).join("")}</datalist><div class="actions">${intake.scoped?btn("Cancel",leaveIntake):btn("Back to folders",()=>toStep(3))}${btn("Save & open project →",finishIntake,"primary")}</div>`;
 for(const fields of panel.querySelectorAll(".series-fields")){for(const label of [...fields.querySelectorAll(":scope > label")]){const control=label.htmlFor?document.getElementById(label.htmlFor):null,wrapper=document.createElement("div");wrapper.className="series-input";label.before(wrapper);wrapper.append(label);if(control)wrapper.append(control)}}
 visible.forEach((g,offset)=>{const i=start+offset;
  $("#class"+i).setAttribute("list","commonClasses");$("#type"+i).placeholder="Character, environment, prop…";
  for(const [prefix,k] of [["asset","asset"],["disc","discipline"],["class","classification"],["type","type"],["emoji","emoji"],["note","note"],["from","parent"],["groupTool","tool"]])$("#"+prefix+i).oninput=e=>{g[k]=e.target.value;if(k==="emoji")g.badgeEdited=true;if(k==="asset"){g.parent="";$("#from"+i).innerHTML=sourceOptions(g)}saveGroup(g)};
  $(`[data-keep="${i}"]`).onchange=e=>{g.selected=e.target.checked;saveGroup(g)};
  $("#cover"+i).onchange=async e=>{
    const file=e.target.files[0];if(!file)return;const scope=intake;pendingCovers.set(g,file);
    e.target.closest(".image-field").querySelector(".paste-status").textContent="Loading image…";
    try{const ref=await uploadPreview(file);if(intake===scope&&pendingCovers.get(g)===file){g.cover=ref;saveGroup(g);if(locationState.view==="setup")render()}}
    catch(err){if(intake===scope)toast(err.message)}finally{if(pendingCovers.get(g)===file)pendingCovers.delete(g)}
  }
 });
 for(const el of panel.querySelectorAll("[data-file]"))el.oninput=()=>{const [i,j]=el.dataset.file.split(",");const g=manifest[i];g.notes[g.files[j].path]=el.value;saveGroup(g)}
}
function assetClass(p,r,name){
 let parent="";for(const part of name.split(/\s*(?:\/|›|→|>)\s*/).map(n=>n.trim()).filter(Boolean)){
   let c=p.classes.find(c=>c.section===r.section&&c.parent===parent&&c.name.toLowerCase()===part.toLowerCase());
   if(!c){c={id:id(),name:part,section:r.section,parent,fields:[]};p.classes.push(c)}parent=c.id
 }
 if(parent)r.cls=parent;
}
async function finishIntake(){
 if(manifest.some(g=>g.selected&&pendingCovers.has(g)))throw Error("Wait for the preview image to finish loading.");
 let first;
 await change(p=>{
   const paths=new Set(p.revisions.filter(v=>v.path).map(v=>pathKey(v.path)));
   for(const g of manifest.filter(g=>g.selected)){
     const name=g.asset.trim();if(!name)throw Error("Give each selected series an asset name.");
     const matches=p.records.filter(r=>r.name.toLowerCase()===name.toLowerCase());if(matches.length>1)throw Error("Resolve the duplicate asset name: "+name);
     const section=ensureSection(p,g.discipline);let r=matches[0];if(!r){r={id:id(),name,section:section.id,cls:"",values:{},links:[],description:"",cover:""};p.records.push(r)}
     if(g.cover)r.cover=g.cover;r.intakeReviewed=true;r.emoji=g.badgeEdited?g.emoji||freshBadge():r.emoji||g.emoji||freshBadge();r.assetType=g.type||r.assetType||"";assetClass(p,r,g.classification.trim());r.seriesNotes||={};if(g.note&&g.files.length>1)r.seriesNotes[g.discipline]=g.note;
     let parent=g.parent||"";if(parent&&find(p.revisions,parent)?.record!==r.id)throw Error("Choose a source on the same asset.");
     for(const f of g.files){if(paths.has(pathKey(f.path)))continue;
       const v={id:id(),tool:g.tool,record:r.id,path:f.path,label:f.label,discipline:g.discipline,branch:g.discipline,parent,note:g.notes[f.path]||(g.files.length===1?g.note:""),preview:"",comparisons:[]};p.revisions.push(v);paths.add(pathKey(f.path));first||=v;parent=""
     }
     connectMilestones(p,r.id,g.tool,g.discipline,g.format);
   }
 });
 localStorage.removeItem(intakeSlot);intake=null;manifest=[];if(first)openRecord(first.record,"History",{revision:first.id});else go("home");toast("Your studio is ready.")
}
