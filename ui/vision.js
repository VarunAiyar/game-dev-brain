"use strict";
const visualCases={
 trace:{project:"canopy",asset:"ridge-raptor",name:"Screenshot trace",revisions:["raptor-scout","raptor-crest","raptor-armor"]},
 compare:{project:"brine",asset:"floodgate",name:"Revision comparison",revisions:["gate-blockout","gate-lockdown"]}
};
let visualTour=null;
function caseAvailable(c){
 const p=find(data.projects,c.project);
 return p&&find(p.records,c.asset)&&c.revisions.every(id=>p.revisions.some(v=>v.id===id&&v.record===c.asset&&v.preview))
}
function startVisualTour(kind){
 const c=visualCases[kind];
 if(!c||!caseAvailable(c))return false;
 stopVisualTour();
 visualTour={kind,c,stage:"intro",target:null,frame:0};
 locationState.project=c.project;
 openRecord(c.asset,"History",{revision:c.revisions[c.revisions.length-1]});
 return true
}
function startBranchTour(asset){
 stopVisualTour();
 visualTour={kind:"branches",c:{project:"brine",asset:asset.id,name:"Branch editor"},stage:"intro",target:null,frame:0};
 locationState.project="brine";
 for(const cls of lineage(asset.cls))closedClasses.delete(project().id+"/"+cls.id);
 go("home");
 return true
}
function ownBranchTourState(projectId){
 return {kind:"own",c:{project:projectId,name:"Your project"},stage:"intro",target:null,frame:0}
}
function startOwnBranchTour(projectId){
 stopVisualTour();visualTour=ownBranchTourState(projectId);
 locationState.project=projectId;go("home")
}
function stopVisualTour(){
 if(!visualTour)return;
 cancelAnimationFrame(visualTour.frame);
 visualTour.target?.classList.remove("tour-target");
 visualTour.extraTarget?.classList.remove("tour-target");
 visualTour.card?.remove();
 visualTour=null
}
function tourStage(kind,stage){
 if(visualTour?.kind!==kind)return;
 visualTour.stage=stage;
 syncVisualTour()
}
function advanceVisualTour(){
 const t=visualTour;if(!t)return;
 if(t.stage==="done"){stopVisualTour();return}
 if(t.stage==="intro"){tourStage(t.kind,t.kind==="branches"||t.kind==="own"?"classes":"open");return}
 if(t.kind==="own"){
   if(t.stage==="graph"){stopVisualTour();return}
   tourStage("own",t.stage==="classes"?"asset":"graph");return
 }
 if(t.kind==="branches"){
   if(t.stage==="classes"){tourStage("branches","asset");return}
   if(t.stage==="asset"){
     const wide=find(project().revisions,"l72");
     openRecord(t.c.asset,"History",wide?.record===t.c.asset?{revision:wide.id}:{});
     return
   }
   const steps=["select","note","fork","connect","arrange"];
   tourStage("branches",steps[steps.indexOf(t.stage)+1]||"done")
 }
}
function syncVisualTour(){
 const t=visualTour;if(!t)return;
 const trace=t.kind==="trace",branches=t.kind==="branches",own=t.kind==="own";
 const inLibrary=locationState.view==="home",inRecord=locationState.view==="record"&&!!record();
 const sampleRecord=inRecord&&record().id===t.c.asset;
 if(project().id!==t.c.project||(!branches&&!own&&!sampleRecord)||(branches&&!inLibrary&&!sampleRecord)||(own&&!inLibrary&&!inRecord)){stopVisualTour();return}
 if(branches&&sampleRecord&&t.stage==="asset")t.stage="select";
 if(branches&&((inLibrary&&!["intro","classes","asset"].includes(t.stage))||(sampleRecord&&["intro","classes"].includes(t.stage)))){stopVisualTour();return}
 if(own&&inRecord&&t.stage!=="graph")t.stage="graph";
 const onGraph=inRecord&&locationState.tab==="History",pane=dialog.open&&$("#tracePane");
 if(branches&&sampleRecord&&!onGraph){stopVisualTour();return}
 const branchForm=branches&&dialog.open&&activeDrawer==="Create branch"&&t.stage==="fork";
 let instruction,selector,number,title=t.c.name,extraTarget;
 const count=branches?8:own?4:5;
 if(t.stage==="intro"){
   number=1;
   if(branches){
     title="Your asset’s history";
     instruction="Think back to that asset you made in Blender. You saved a few versions, tried a couple of different ideas, then took one into another program. Weeks later, the files are still there, but remembering which one led to which? That’s the hard part.\n\nThe branch editor gives that asset one visual history. Each card is a saved version, and the arrows show how the versions connect. You can branch off an experiment, connect files from different software, and leave yourself notes along the way.\n\nLet’s try it with an example."
   }else if(own){
     title="Your project, your way";
     instruction="Your asset library is ready. You can make your own classes, put assets where they belong, and connect their files into a revision history.\n\nThis short tour will point out where to start. Hover over an ⓘ beside a field, or hover over a button, whenever you want more detail."
   }else if(trace){
     title="Find your way back to a file";
     instruction="You’re playing your game and spot an asset you want to change. You’ve saved several versions, but which project file did the in-game asset come from? And which file has your most recent changes?\n\nChoose the asset in a screenshot. SAM finds it, then Muse Spark compares it with the previews you’ve saved for that asset. Open a likely match in the graph and follow its history to look for newer work.\n\nLet’s try it with a playtest screenshot."
   }else{
     title="Which version do you want to use?";
     instruction="You’ve got two versions of an asset. One has a change you liked, but you can’t remember which one it was.\n\nCompare puts the saved previews and quick notes for both versions side by side. Muse Spark can look at the previews, point out visible changes, and help you write a comparison note you can save for later.\n\nLet’s compare two versions."
   }
 }else if(t.stage==="done"){
   title="You’re all set";
   instruction=branches?"Ready to set up your own game? Head to the homepage, or try the other feature examples.":"Your comparison note and change markers are saved with these two revisions. Reopen the pair to see them.";
   if(trace)instruction="Your screenshot crop and match evidence are saved under Sources & decisions. Choose Show in graph on a likely match to follow its history.";
   number=count
 }else if((branches||own)&&inLibrary&&t.stage==="classes"){
   number=2;title="Give your assets a home";selector=".root-class";
   extraTarget=document.querySelector('.class-group .class-actions button[aria-label^="Add a subclass"]');
   instruction="Use + Root class for a broad category, like NPCs. Use the + beside a class to add a more specific group, like Wildlife or Enemies. You can edit and organize them later."
 }else if(branches&&inLibrary&&t.stage==="asset"){
   number=3;title="Open an asset";selector=`[data-asset="${CSS.escape(t.c.asset)}"]`;
   instruction="When you add or edit an asset, choose its class so it appears in the right group. Select this example asset to open its history."
 }else if(own&&t.stage==="asset"){
   number=3;title="Add an asset";selector=".add-asset";
   instruction="Use + Add asset to name something in your game and choose its class. You can also attach a working file, choose its software, and leave a note."
 }else if(own&&t.stage==="graph"){
   number=4;title="Follow its history";
   if(inLibrary){
     selector=project().records.length?".asset-line[data-asset]":".add-asset";
     instruction="Open an asset and choose History to add files, branches, and notes. Hover over an ⓘ whenever you want an explanation."
   }else if(onGraph){
     selector=".graph-title";
     instruction="This is the asset’s revision graph. Add working files, connect their history, and leave notes. Hover over an ⓘ whenever you want an explanation."
   }else{
     selector=".tabs .tab-history";
     instruction="Choose History to see this asset’s revision graph. Hover over an ⓘ whenever you want an explanation."
   }
 }else if(branches&&onGraph){
   if(t.stage==="connect"&&t.branchCreated&&!dialog.open&&!t.connectionFramed){
     t.connectionFramed=true;document.querySelector('[data-zoom="fit"]')?.click()
   }
   if(t.stage==="select"){number=4;title="Pick a version";selector=".rev-card.selected .rev-face";instruction="Click a card to see its preview, source, and notes. Tracked files appear here too."}
   else if(t.stage==="note"){number=5;title="Leave a note";selector="#inlineNote";instruction="What would you want to remember about this version? Write a quick note and choose Save note."}
   else if(t.stage==="fork"){
     number=6;title="Try a different direction";selector=branchForm?"#branch":".fork-from-here";
     instruction=branchForm?"Name your new branch and version, then choose Save.":"Want to experiment without losing track of where you started? Choose Fork from here, then name your new branch and version."
   }else if(t.stage==="connect"){
     number=7;title="Connect your files";
     selector=t.branchSource?`[data-revision="${CSS.escape(t.branchSource)}"] .outlet`:".rev-card.selected .outlet";
     extraTarget=t.branchCreated?document.querySelector(`[data-revision="${CSS.escape(t.branchCreated)}"] .inlet`):null;
     instruction=t.branchCreated?"Your new branch is already connected to its source. Try dragging from the highlighted dot on the source to the highlighted dot on your new version.":"Did one file lead to another? Drag from the dot on the right of one card to the dot on the left of the next. That arrow records the connection."
   }else{
     number=8;title="Make the graph yours";selector=".rev-card.selected .rev-face";
     instruction="Drag a card to move it around. You can use Earlier and Later to change the order of versions in a branch."
   }
 }else if(trace&&pane){
   t.opened=true;
   if(t.stage==="open")t.stage="crop";
   if(t.stage==="save"){selector="[data-keep-trace]";number=5;title="Follow the trail";instruction="Review the matches and save the result to Sources & decisions. Then choose Show in graph to see where a likely match fits in the asset’s history."}
   else if(t.stage==="match"){selector="[data-trace]";number=4;title="Find a match";instruction="Choose which revision previews to check, then select Find matching revisions. Muse Spark will compare them with the screenshot."}
   else{selector=pane.querySelector(".trace-crop").hidden?"[data-sample]":".trace-crop canvas";number=3;title="Pick the asset";instruction="Click the asset in the screenshot. SAM will find the area to compare. You can also draw a box around it yourself."}
   if(!hasKey&&pane.querySelector(".trace-key")?.open){selector="[data-key]";instruction="Enter your Meta Model API key and choose Connect for this session."}
 }else if(trace&&onGraph&&!t.opened){
   selector=".graph-toolbar .vision-launch";number=2;title="Open screenshot trace";instruction="Choose Screenshot trace. We’ve loaded an example screenshot for you."
 }else if(!trace&&onGraph&&t.stage==="open"){
   selector=".tabs .tab-compare";number=2;title="Open Compare";instruction="Choose Compare. We’ve picked two example revisions so you can see how it works."
 }else if(!trace&&locationState.tab==="Compare"&&$("#before")?.value===t.c.revisions[0]&&$("#after")?.value===t.c.revisions[1]){
   if(t.stage==="open")t.stage="highlight";
   if(t.stage==="save"){selector=".save-comparison";number=5;title="Save your comparison";instruction="Review the note, change anything you want, and choose Save comparison. It’ll stay with this pair of revisions."}
   else if(t.stage==="inspect"){selector=".see-markers";number=4;title="Take a closer look";instruction=$("[data-marker]")?"Select a finding to see its markers on the previews. Take a look at both versions and decide what matters to you.":"Read the result, then view both previews to check the comparison yourself."}
   else{selector="[data-highlight]";number=3;title="Look for changes";instruction="Choose Highlight changes. Muse Spark will look at both previews and point out what it sees."}
   if(dialog.open&&$("#key")){selector="#key";instruction="Enter your Meta Model API key and save it. Then choose Highlight changes."}
 }else{stopVisualTour();return}
 const target=selector&&$(selector);
 if(dialog.open&&!pane&&!$("#key")&&!branchForm){t.card?.remove();t.card=null;return}
 const host=dialog.open?dialog:document.body;
 if(!t.card){
   t.card=document.createElement("aside");t.card.className="lab-coach";t.card.setAttribute("popover","manual");t.card.setAttribute("aria-label","Guided example");
   t.card.innerHTML='<header><span class="coach-count" role="status"></span><button type="button" class="coach-close" aria-label="Dismiss guided example">×</button></header><strong></strong><p aria-live="polite"></p><button type="button" class="coach-find" hidden>Show control ↗</button><div class="coach-finish" hidden><a href="?view=welcome&amp;branchTour=own">Create my project →</a><a href="?view=help#examples">Try another feature →</a></div><button type="button" class="coach-next" hidden></button><div class="coach-meter" aria-hidden="true"><i></i></div>';
   t.card.querySelector(".coach-close").onclick=stopVisualTour;
   t.card.querySelector(".coach-find").onclick=()=>t.target?.scrollIntoView({block:"center",inline:"nearest"});
   t.card.querySelector(".coach-next").onclick=advanceVisualTour
 }
 if(t.card.parentElement!==host)host.append(t.card);
 if(!t.card.matches(":popover-open"))t.card.showPopover();
 t.card.classList.toggle("coach-intro",t.stage==="intro");
 t.card.querySelector(".coach-count").textContent=t.stage==="done"?"✓ Complete · "+count+"/"+count:"Progress "+number+"/"+count;
 t.card.querySelector("strong").textContent=title;
 t.card.querySelector("p").textContent=instruction;t.card.querySelector("i").style.width=number/count*100+"%";
 const next=t.card.querySelector(".coach-next");
 t.card.querySelector(".coach-finish").hidden=!(branches&&t.stage==="done");
 next.hidden=!(t.stage==="intro"||t.stage==="done"||((branches||own)&&!dialog.open));
 next.textContent=t.stage==="intro"?(branches?"Let’s try it →":own?"Let’s go →":trace?"Let’s trace it →":"Let’s compare →"):t.stage==="done"?"Done":own?(t.stage==="graph"?"Finish":"Next →"):t.stage==="classes"?"Next →":t.stage==="asset"?"Open asset →":"Skip step →";
 const changed=t.target!==target||t.positionStage!==t.stage;
 if(t.target!==target)t.target?.classList.remove("tour-target");
 if(t.extraTarget!==extraTarget)t.extraTarget?.classList.remove("tour-target");
 t.extraTarget=extraTarget;extraTarget?.classList.add("tour-target");
 t.target=target;t.positionStage=t.stage;target?.classList.add("tour-target");
 if(changed&&target&&!(t.kind==="compare"&&t.stage==="save"))target.scrollIntoView({block:branches?"center":"nearest",inline:"nearest",behavior:"instant"});
 positionVisualTour()
}
function positionVisualTour(){
 const t=visualTour;if(!t?.card)return;
 cancelAnimationFrame(t.frame);t.frame=requestAnimationFrame(()=>{
   if(visualTour!==t)return;
   const pad=12,card=t.card,box=t.target?.getBoundingClientRect();
   const below=t.target?.matches(".trace-crop canvas")?t.target.closest(".trace-source").querySelector(".trace-controls").getBoundingClientRect().bottom:box?.bottom;
   card.querySelector(".coach-find").hidden=!box||(box.bottom>0&&box.top<innerHeight);
   const w=card.offsetWidth,h=card.offsetHeight,width=document.documentElement.clientWidth;
   const clamp=(v,max)=>Math.max(pad,Math.min(v,max-pad));
   let left=width-w-pad,top=innerHeight-h-pad;
   if(t.stage==="intro"){left=clamp((width-w)/2,width-w);top=clamp((innerHeight-h)/2,innerHeight-h)}
   else if(box&&box.bottom>0&&box.top<innerHeight){
     left=clamp(box.left,width-w);
     if(below+h+pad*2<=innerHeight)top=below+pad;
     else if(box.top-h-pad>=pad)top=box.top-h-pad;
     else if(box.right+w+pad*2<=width){left=box.right+pad;top=clamp(box.top,innerHeight-h)}
     else if(box.left-w-pad>=pad){left=box.left-w-pad;top=clamp(box.top,innerHeight-h)}
     else top=box.top<innerHeight/2?innerHeight-h-pad:pad
   }
   const extra=t.extraTarget?.getBoundingClientRect();
   const overlaps=(x,y,rect)=>rect&&x<rect.right+pad&&x+w>rect.left-pad&&y<rect.bottom+pad&&y+h>rect.top-pad;
   if(box&&extra&&overlaps(left,top,extra)){
     const beside=box.left-w-pad,belowExtra=extra.bottom+pad;
     if(beside>=pad&&!overlaps(beside,top,extra))left=beside;
     else if(belowExtra+h<=innerHeight-pad){top=belowExtra;left=clamp(extra.left,width-w)}
     else if(Math.min(box.top,extra.top)-h-pad>=pad)top=Math.min(box.top,extra.top)-h-pad
   }
   Object.assign(card.style,{left:left+"px",top:top+"px"})
 })
}
window.addEventListener("resize",positionVisualTour);
document.addEventListener("scroll",positionVisualTour,true);
document.addEventListener("animationend",positionVisualTour,true);
document.addEventListener("DOMContentLoaded",()=>{
 const editor=document.querySelector("#editor");
 editor.addEventListener("toggle",syncVisualTour);
 editor.addEventListener("close",()=>{if(visualTour?.kind==="trace"&&visualTour.opened&&!editor.open)stopVisualTour();else syncVisualTour()})
});
function visualReview(out,a,b,saved){
 const review={current:saved?.beforePreview===a.preview&&saved?.afterPreview===b.preview?saved:null};
 const panel=document.createElement("section");panel.className="panel visual-review";out.prepend(panel);
 panel.innerHTML=`<div class="spread"><div><small class="eyebrow">Meta vision</small><h2>Visual change markers</h2></div><button type="button" class="primary ai-action" data-highlight>Highlight changes</button></div><p class="sub">Inspect the two previews and point to what changed.</p><div data-findings aria-live="polite"></div><label class="marker-toggle" hidden><input type="checkbox" checked> Show markers on both previews</label>`;
 const button=panel.querySelector("[data-highlight]"),findings=panel.querySelector("[data-findings]");
 const toggle=panel.querySelector(".marker-toggle"),visibility=toggle.querySelector("input");let active=0;visibility.onchange=paint;
 function paint(){
   for(const container of out.querySelectorAll(".visual-preview")){
     container.querySelector("svg")?.remove();
     const img=container.querySelector("img"),box=review.current?.changes[active]?.[container.dataset.side];
     if(!img||!box||!img.naturalWidth||!visibility.checked)continue;
     const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),rect=document.createElementNS(svg.namespaceURI,"rect");
     const w=img.naturalWidth,h=img.naturalHeight;
     svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("aria-hidden","true");
     for(const [key,value] of Object.entries({x:box[0]*w/1000,y:box[1]*h/1000,width:(box[2]-box[0])*w/1000,height:(box[3]-box[1])*h/1000}))rect.setAttribute(key,value);
     svg.append(rect);container.append(svg)
   }
   findings.querySelectorAll("[data-marker]").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===active)))
 }
 function draw(){
   const v=review.current;toggle.hidden=!v?.changes.length;
   if(!v){findings.replaceChildren();return}
   findings.innerHTML=`<p>${esc(v.summary)}</p><div class="marker-list">${v.changes.map((c,i)=>`<button type="button" data-marker="${i}"><strong>${i+1} · ${esc(c.part)}</strong> ${esc(c.detail)}</button>`).join("")}</div><button type="button" class="see-markers">${v.changes.length?"View marked previews":"View both previews"} ↓</button>`;
   const see=findings.querySelector(".see-markers");
   if(see)see.onclick=()=>{out.querySelector(".compare-pair")?.scrollIntoView({block:"start"});tourStage("compare","save")};
   for(const b of findings.querySelectorAll("[data-marker]"))b.onclick=b.onpointerenter=b.onfocus=()=>{active=Number(b.dataset.marker);paint()};
   paint()
 }
 for(const img of out.querySelectorAll(".visual-preview img"))img.addEventListener("load",paint);
 draw();
 if(!a.preview||!b.preview){button.disabled=true;button.title="Attach a screenshot to each revision first."}
 button.onclick=async()=>{
   if(!hasKey){keyForm();return}
   button.disabled=true;button.textContent="Finding changes…";findings.textContent="Muse Spark is inspecting both screenshots.";panel.setAttribute("aria-busy","true");
   try{
     const v=await post("ai",{project:project().id,mode:"highlight",before:a.id,after:b.id});
     if(!panel.isConnected)return;
     if(v.beforePreview!==a.preview||v.afterPreview!==b.preview)throw Error("A preview changed. Reopen Compare to analyze the latest images.");
     review.current=v;active=0;draw();
     if($("#diff")&&!$("#diff").value.trim())$("#diff").value=[v.summary,...v.changes.map(c=>c.part+" — "+c.detail)].join("\n");
     tourStage("compare","inspect");toast("Review the markers, then save the comparison.")
   }catch(err){if(panel.isConnected){draw();const msg=document.createElement("p");msg.className="error";msg.textContent=err.message;findings.append(msg)}}
   finally{button.disabled=false;button.textContent="Highlight changes";panel.setAttribute("aria-busy","false")}
 };
 return review
}

function traceScreenshot(r,revs,useExample=false){
 if(!revs.length){
   revisionForm(null,{record:r.id});
   $("#fields").insertAdjacentHTML("afterbegin",`<p>To trace a screenshot to ${esc(r.name)}, choose its source file and attach a preview of that version. Then open Screenshot trace again.</p>`);
   return
 }
 let candidates=orderedRevisions(revs.filter(v=>v.preview));
 const example=project().id==="canopy"&&["ridge-raptor","bird"].includes(r.id);
 const guided=visualTour?.kind==="trace"&&visualTour.c.asset===r.id;
 const choices=checked=>candidates.map(v=>`<label class="trace-candidate"><input type="checkbox" value="${esc(v.id)}" ${checked.includes(v.id)?"checked":""}>${image(v.preview,"candidate-thumb","")}<span>${toolIcon(toolName(v.tool))} ${esc(nodeTitle(v))}<small>${esc(v.path||v.branch)}</small></span></label>`).join("");
 const missingOptions=()=>orderedRevisions(revs.filter(v=>!v.preview)).map(v=>opt(v.id,v.path||revisionLabel(v),"")).join("");
 const missing=missingOptions();
 modal(traceLabel,`<div id="tracePane"><small class="eyebrow">Meta vision · ${esc(r.name)}</small>
 <div class="trace-workspace">
   <section class="trace-source"><h3>1. Pick the subject</h3><p>Paste your engine screenshot. Click the asset for a SAM 3.1 crop, or drag a box around it.</p>
   <details class="trace-input" open><summary>Choose screenshot</summary>${pictureField("traceShot","")}${example?'<button type="button" data-sample>Use example playtest frame</button>':""}</details>
   <div class="trace-crop" hidden><canvas tabindex="0" aria-label="Screenshot. Drag to crop to the asset."></canvas><div class="trace-box" hidden></div></div>
   <div class="trace-controls"><button type="button" data-full>Use full frame</button><small data-size></small></div></section>
   <section class="trace-revisions"><h3>2. Find the revision</h3><p>Muse Spark checks the region against the previews you choose.</p>
   <details class="trace-choices" open><summary>Candidate revisions <span data-count></span></summary><div data-candidates>${choices(candidates.slice(-8).map(v=>v.id))}</div></details>
   ${missing?`<details class="trace-reference" ${candidates.length?"":"open"}><summary>Add a file preview</summary><p>Choose a revision and attach a screenshot of that file open in your editor. Muse Spark uses this as its reference.</p>${select("traceRevision","Source revision",missing)}${pictureField("traceReference")}<button type="button" data-save-reference>Save file preview</button><small data-reference-status role="status"></small></details>`:""}
   ${hasKey?"":`<details class="trace-key"><summary>${metaLensMark()} Connect Meta AI</summary><p>Connect a key to crop this subject and match it against the checked revisions.</p><label>Meta Model API key<input type="password" data-key autocomplete="off" spellcheck="false"></label><button type="button" data-connect>Connect for this session</button></details>`}<button type="button" class="primary ai-action" data-trace>Find matching revisions</button><div data-trace-results aria-live="polite"></div></section>
 </div><small class="trace-disclosure">Clicking sends the frame and point to Meta. Matching sends only the selected region and checked previews. Filenames and notes stay on your PC.</small></div>`,()=>{},"Done");
 const pane=$("#tracePane"),field=$("#traceShot"),wrap=pane.querySelector(".trace-crop"),canvas=wrap.querySelector("canvas"),outline=wrap.querySelector(".trace-box"),results=pane.querySelector("[data-trace-results]"),run=pane.querySelector("[data-trace]"),size=pane.querySelector("[data-size]");
 const keyBox=pane.querySelector(".trace-key");
 function requestKey(){if(keyBox){keyBox.open=true;keyBox.querySelector("input").focus()}results.textContent="Connect a Meta Model API key for this session, then try again.";syncVisualTour()}
 if(keyBox){
   const input=keyBox.querySelector("input"),connect=keyBox.querySelector("button");
   connect.onclick=async()=>{if(!input.value.trim()){input.focus();return}connect.disabled=true;
     try{await setSessionKey(input.value.trim());input.value="";keyBox.hidden=true;results.textContent="Key configured. Click a subject or find matching revisions.";syncVisualTour()}
     catch(err){results.textContent=err.message}finally{connect.disabled=false}
   };
   input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();connect.click()}}
 }
 const checks=()=>[...pane.querySelectorAll(".trace-candidate input:checked")].map(el=>el.value);
 const full=pane.querySelector("[data-full]");let crop=null,anchor=null,previousCrop=null,version=0,ready=false,pending=false;
 function sync(){
   const n=checks().length;
   pane.querySelector("[data-count]").textContent=`${n} of ${candidates.length}`;
   full.disabled=!ready||pending;run.disabled=!ready||!n||n>8||pending;
   if(n>8)size.textContent="Choose up to eight candidate previews.";
   else size.textContent=crop?"Comparing the outlined region.":ready?"Comparing the full screenshot.":"";
 }
 function invalidate(){version++;pending=false;results.replaceChildren();run.textContent="Find matching revisions";sync();if(guided&&["done","save"].includes(visualTour?.stage))tourStage("trace","match")}
 const saveReference=pane.querySelector("[data-save-reference]");
 if(saveReference)saveReference.onclick=async()=>{
   const key=val("traceRevision"),input=$("#traceReference"),file=input.files[0],status=pane.querySelector("[data-reference-status]");
   if(!file){status.textContent=" Choose or paste a preview of the selected revision first.";input.focus();return}
   saveReference.disabled=true;
   try{
     const path=await uploadPreview(file);
     if(!dialog.open||!pane.isConnected)return;
     await change(p=>{
       const v=find(p.revisions,key);
       if(!v||v.record!==r.id||v.preview)throw Error("This revision changed. Reopen screenshot trace to see its current preview.");
       v.preview=path
     });
     if(!dialog.open||!pane.isConnected)return;
     const checked=checks();
     if(checked.length<8)checked.push(key);
     revs=project().revisions.filter(v=>v.record===r.id);candidates=orderedRevisions(revs.filter(v=>v.preview));
     pane.querySelector("[data-candidates]").innerHTML=choices(checked);
     $("#traceRevision").innerHTML=missingOptions();
     input.value="";input.closest(".image-field").querySelector(".paste-status").textContent="";
     const details=saveReference.closest("details");details.open=false;details.hidden=!$("#traceRevision").options.length;
     invalidate();render();toast("File preview saved.")
   }catch(err){status.textContent=" "+err.message}finally{saveReference.disabled=false}
 };
 pane.querySelector(".trace-choices").onchange=invalidate;
 function drawBox(){
   outline.hidden=!crop;
   if(crop)Object.assign(outline.style,{left:100*crop.x/canvas.width+"%",top:100*crop.y/canvas.height+"%",width:100*crop.w/canvas.width+"%",height:100*crop.h/canvas.height+"%"});
   sync()
 }
 full.onclick=()=>{crop=null;invalidate();drawBox();tourStage("trace","match")};
 field.onchange=async()=>{
   ready=false;crop=null;anchor=null;wrap.hidden=true;invalidate();drawBox();
   const file=field.files[0];if(!file)return;
   try{
     const bmp=await createImageBitmap(file);
     try{
       if(!pane.isConnected||field.files[0]!==file)return;
       const scale=Math.min(1,1280/Math.max(bmp.width,bmp.height));
       canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));
       const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
       wrap.style.width=Math.min(canvas.width,385*canvas.width/canvas.height)+"px";ready=true;wrap.hidden=false;
       const picker=pane.querySelector(".trace-input");picker.open=false;picker.querySelector("summary").textContent="Replace screenshot";sync();tourStage("trace","crop")
     }finally{bmp.close()}
   }catch(err){if(field.files[0]===file)results.textContent="The screenshot could not be read. Try a PNG or JPEG."}
 };
 const sampleButton=pane.querySelector("[data-sample]");if(sampleButton)sampleButton.onclick=async()=>{try{const res=await fetch(r.id==="ridge-raptor"?"/art/raptor-frame.jpg":"/art/playtest.jpg");if(!res.ok)throw Error("Could not load the example frame.");const file=new File([await res.blob()],"Canopy Run · "+r.name+" playtest.jpg",{type:"image/jpeg"});await assignScreenshot(field.closest(".image-field"),file)}catch(err){results.textContent=err.message}};
 function at(e){const b=canvas.getBoundingClientRect();return {x:Math.round(Math.max(0,Math.min(1,(e.clientX-b.left)/b.width))*canvas.width),y:Math.round(Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))*canvas.height)}}
 canvas.onpointerdown=e=>{if(e.button!==0||!e.isPrimary)return;previousCrop=crop;anchor=at(e);canvas.setPointerCapture(e.pointerId);invalidate();e.preventDefault()};
 canvas.onpointermove=e=>{if(!anchor)return;const pt=at(e);crop={x:Math.min(anchor.x,pt.x),y:Math.min(anchor.y,pt.y),w:Math.abs(anchor.x-pt.x),h:Math.abs(anchor.y-pt.y)};drawBox()};
 canvas.onpointercancel=()=>{anchor=null;crop=previousCrop;drawBox()};
 canvas.onpointerup=async e=>{
   if(!anchor)return;const p=at(e),clicked=Math.hypot(p.x-anchor.x,p.y-anchor.y)<5;anchor=null;
   if(!clicked){if(crop&&(crop.w<8||crop.h<8))crop=null;drawBox();if(crop)tourStage("trace","match");return}
   crop=previousCrop;drawBox();
   if(!hasKey){requestKey();return}
   const stamp=++version;pending=true;sync();results.textContent="SAM 3.1 is locating the clicked asset…";
   try{
     const result=await post("ai",{mode:"locate",project:project().id,jpeg:canvas.toDataURL("image/jpeg",.88).split(",")[1],width:canvas.width,height:canvas.height,x:Math.min(canvas.width-1,p.x),y:Math.min(canvas.height-1,p.y)});
     if(stamp!==version||!pane.isConnected||!dialog.open)return;
     if(result.box){const [x,y,w,h]=result.box;crop={x,y,w,h};results.textContent="SAM crop ready. Find matching revisions to compare this region.";tourStage("trace","match")}
     else{crop=null;results.textContent="No subject found at that point. Drag a crop or click another part."}
     drawBox()
   }catch(err){if(stamp===version&&pane.isConnected)results.textContent=err.message}
   finally{if(stamp===version){pending=false;sync()}}
 };
 sync();if(useExample||guided)sampleButton?.click();syncVisualTour();
 run.onclick=async()=>{
   if(!hasKey){requestKey();return}
   if(!ready||pending)return;
   if(anchor||(crop&&(!crop.w||!crop.h)))return;
   tourStage("trace","match");
   const roi=crop||{x:0,y:0,w:canvas.width,h:canvas.height},sample=document.createElement("canvas");
   sample.width=roi.w;sample.height=roi.h;sample.getContext("2d").drawImage(canvas,roi.x,roi.y,roi.w,roi.h,0,0,roi.w,roi.h);
   const stamp=++version;pending=true;sync();run.textContent="Comparing previews…";results.textContent="Muse Spark is comparing shapes and surface details. Filenames and notes stay local.";
   try{
     const jpeg=sample.toDataURL("image/jpeg",.88).split(",")[1],chosen=checks();
     const res=await post("ai",{project:project().id,record:r.id,mode:"trace",revisions:chosen,jpeg});
     if(stamp!==version||!pane.isConnected||!dialog.open)return;
     const titles={likely:"Likely visual match",ambiguous:"Several versions could match",no_match:"No supported match"};
     results.innerHTML=`<h3>${esc(titles[res.status])}</h3><p>${esc(res.summary)}</p>`;
     for(const match of res.matches){
       const row=document.createElement("section");row.className="trace-result";
       const files=match.revisions.map(key=>find(revs,key)).filter(Boolean);
       row.innerHTML=`${files[0]?image(files[0].preview,"trace-thumb","Candidate preview"):""}<div><p>${esc(match.evidence)}</p>${files.length>1?"<small>These revisions share the same screenshot.</small>":""}</div>`;
       for(const v of files){
         const open=document.createElement("button");open.type="button";open.textContent="Show in graph · "+(nodeTitle(v));open.title=v.path;
         open.onclick=()=>{const live=find(project().revisions,v.id);if(!live||live.record!==r.id||live.preview!==v.preview){results.textContent="This revision changed. Reopen Trace screenshot to compare the current previews.";return}dialog.close();openRecord(r.id,"History",{revision:v.id})};
         row.lastElementChild.append(open)
       }
       results.append(row)
     }
     const keep=document.createElement("button"),sourceId=id(),projectId=project().id;
     keep.type="button";keep.dataset.keepTrace="";keep.textContent="Save to Sources & decisions";results.append(keep);
     const label=v=>nodeTitle(v);
     const source={id:sourceId,kind:"Playtest",name:"Visual trace · "+(field.files[0]?.name||r.name),url:"",note:titles[res.status]+" — "+res.summary,
       excerpt:["Muse Spark compared the screenshot region with "+chosen.length+" revision previews.",...res.matches.map(m=>m.revisions.map(k=>label(find(revs,k))).join(" / ")+" — "+m.evidence)].join("\n"),
       traceRevisions:res.matches.flatMap(m=>m.revisions),traceModel:res.model};
     keep.onclick=async()=>{keep.disabled=true;
       try{
         source.traceImage??=(await post("preview",{jpeg})).preview;
         if(stamp!==version||!dialog.open||!pane.isConnected||project().id!==projectId)return;
         lastCommand="Save screenshot trace";
         await change(p=>{const asset=find(p.records,r.id);asset.sources??=[];if(!find(asset.sources,source.id))asset.sources.push(source)});
         keep.textContent="Saved in Sources & decisions";tourStage("trace","done");toast("Saved the screenshot crop and visual evidence.")
       }catch(err){keep.disabled=false;toast(err.message)}
     };
     results.querySelector("h3")?.scrollIntoView({block:"nearest"});tourStage("trace","save");
   }catch(err){if(stamp===version&&pane.isConnected)results.textContent=err.message}
   finally{if(stamp===version){pending=false;run.textContent="Find matching revisions";sync()}}
 }
}
