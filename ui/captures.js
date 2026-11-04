"use strict";
function captureGuide(){
 modal("Capture from Blender",`<p>In Blender Preferences → Add-ons, choose Install from Disk and enable <strong>Game Dev Brain – Capture checkpoint</strong>.</p>
 <a href="/addon/game_dev_brain.py" download="game_dev_brain.py">Download Blender add-on</a>
 <p>Save your .blend, hover the 3D View, then press <kbd>Ctrl + Alt + Shift + C</kbd>. You can also use View → Game Dev Brain: Capture Checkpoint.</p>
 <p>Captures stay local. With a Meta key connected, comparable viewport images are sent to Meta for an AI note and a SAM outline. Artist notes stay separate.</p>`,()=>{},"Done")
}
function showCapture(parent,v,compact=false){
 const list=v?.checkpoints;if(!list?.length)return;
 const box=document.createElement("section");box.className="checkpoint-panel";parent.append(box);
 if(!compact)box.innerHTML="<h3>Blender checkpoints</h3>";
 const select=document.createElement("select");select.setAttribute("aria-label","Captured viewport");
 for(const [i,c] of list.entries())select.prepend(new Option(new Date(c.time*1000).toLocaleString()+" · "+(c.object||"Viewport"),String(i)));
 select.value=String(list.length-1);if(!compact)box.append(select);
 const body=document.createElement("div");box.append(body);
 let sequence=0;
 async function show(){
   const cp=list[Number(select.value)],seq=++sequence;
   body.textContent="Loading checkpoint…";
   try{
     const res=await post("checkpoint",{mode:"result",id:cp.id});
     if(!box.isConnected||seq!==sequence)return;
     body.innerHTML=`<small>${cp.dirty?"Unsaved viewport · ":""}${esc(cp.mode)} · ${res.status==="done"?"Muse Spark AI note":"Checkpoint"}</small><p>${esc(res.note)}</p>`;
     if(!compact){
       const fig=document.createElement("div");fig.className="checkpoint-figure";body.append(fig);
       fig.innerHTML=image(cp.preview,"","Captured Blender viewport");
       if(res.mask){
         const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg"),path=document.createElementNS(ns,"path");
         const [x,y,w,h]=res.mask.box,[mw,mh]=res.mask.raster;
         svg.setAttribute("viewBox","0 0 "+cp.size.join(" "));path.setAttribute("d",res.mask.path);
         path.setAttribute("transform",`translate(${x} ${y}) scale(${w/mw} ${h/mh})`);svg.append(path);fig.append(svg);
         const toggle=document.createElement("button");toggle.textContent="Hide SAM outline · "+res.mask.part;
         toggle.onclick=()=>{const hidden=svg.style.display==="none";svg.style.display=hidden?"":"none";toggle.textContent=(hidden?"Hide":"Show")+" SAM outline · "+res.mask.part};body.append(toggle)
       }
       if(cp.before){
         const previous=document.createElement("details");previous.innerHTML="<summary>Previous viewport</summary>"+image(cp.before,"checkpoint-before","Previous viewport");body.append(previous)
       }
       if(res.warning){const warn=document.createElement("small");warn.textContent=res.warning;body.append(warn)}
       if(["baseline","offline","error","interrupted"].includes(res.status)||res.warning){
         const retry=document.createElement("button");retry.textContent="Analyze again";retry.onclick=async()=>{if(!hasKey){keyForm();return}retry.disabled=true;try{await post("checkpoint",{mode:"retry",id:cp.id});show()}catch(err){retry.disabled=false;toast(err.message)}};body.append(retry)
       }
     }
     if(res.status==="pending")setTimeout(()=>{if(box.isConnected&&seq===sequence)show()},1700)
   }catch(err){if(box.isConnected&&seq===sequence)body.textContent=err.message}
 }
 select.onchange=show;show()
}

let checkingCaptures=false;
async function refreshCaptureGraph(){
 if(checkingCaptures||document.hidden||!data||busy||dialog.open)return;
 if(!["home","section"].includes(locationState.view)&&(locationState.view!=="record"||locationState.tab!=="History"))return;
 const clean=()=>!busy&&!dialog.open&&!document.querySelector("#quickNote,.graph-marquee:not([hidden]),.rev-card.moving,.graph-scroll.panning")&&(!$("#inlineNote")||$("#inlineNote").value===$("#inlineNote").defaultValue);
 if(!clean())return;
 checkingCaptures=true;
 try{
   const current=version,screen=locationState;
   const check=await fetch("/api/library-version").then(r=>r.json());if(check.version===current)return;
   const fresh=await fetch("/api/state").then(r=>r.json());
   if(version!==current||screen!==locationState||!clean())return;
   const existing=find(fresh.state.projects,screen.project);
   if(!existing||(screen.view==="record"&&!find(existing.records,screen.record)))return;
   ({state:data,version,token,hasKey}=fresh);editHistory=fresh.history;render();
   const latest=check.latest,target=latest&&find(data.projects,latest.project);
   if(target&&find(target.revisions,latest.revision)?.checkpoints?.some(c=>c.id===latest.id)&&fresh.history.undo?.startsWith("Blender checkpoint")){
     toast("Blender captured · "+latest.label+" ");
     const jump=document.createElement("button");jump.textContent="Open checkpoint";jump.onclick=()=>{locationState.project=target.id;openRecord(latest.record,"History",{revision:latest.revision})};$("#toast").append(jump)
   }
 }catch{/* The server can be restarted while Blender is active. */}
 finally{checkingCaptures=false}
}
window.addEventListener("focus",refreshCaptureGraph);setInterval(refreshCaptureGraph,3000);
