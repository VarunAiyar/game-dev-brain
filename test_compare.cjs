"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const {setTimeout: delay} = require("node:timers/promises");

async function until(check, description) {
  const end = Date.now() + 15000;
  do {
    const result = await check();
    if (result) return result;
    await delay(60);
  } while (Date.now() < end);
  throw Error("Timed out waiting for " + description);
}

async function devtools(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = e => {
    const msg = JSON.parse(e.data), reply = pending.get(msg.id);
    if (reply) {pending.delete(msg.id); reply(msg)}
  };
  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, msg => msg.error ? reject(Error(msg.error.message)) : resolve(msg.result));
      socket.send(JSON.stringify({id, method, params}));
    });
  }
  async function evaluate(expression) {
    const answer = await send("Runtime.evaluate", {expression, returnByValue:true, awaitPromise:true});
    if (answer.exceptionDetails) throw Error(answer.exceptionDetails.exception?.description || answer.exceptionDetails.text);
    return answer.result.value;
  }
  return {send, evaluate, socket};
}

test("Graph selection, exact revision comparisons, visual review, screenshot tracing and native-format intake", {timeout:90000}, async t => {
  const browser = process.env.EDGE_PATH || path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe");
  await fs.access(browser);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-brain-compare-"));
  const profile = path.join(temp, "edge");
  const serve = [
    "import app, sys",
    "app.DATA = app.Path(sys.argv[1])",
    "app.initialize()",
    "server = app.LocalServer(('127.0.0.1', 0), app.Handler)",
    "print(server.server_port, flush=True)",
    "server.serve_forever()"
  ].join("\n");
  const server = spawn("python", ["-u", "-c", serve, path.join(temp, "library")], {cwd:__dirname, windowsHide:true});
  let edge, client;
  t.after(async () => {
    try {if (client) await client.send("Browser.close")} finally {
      client?.socket.close();
      if (edge && edge.exitCode === null && edge.signalCode === null) {
        await Promise.race([once(edge, "exit"), delay(1500)]);
        if (edge.exitCode === null) edge.kill();
      }
      server.kill();
      await fs.rm(temp, {recursive:true, force:true, maxRetries:8, retryDelay:200});
    }
  });
  const [port] = await once(server.stdout, "data");
  const url = "http://127.0.0.1:" + Number(port.toString().trim());
  const init = await (await fetch(url + "/api/state")).json();
  const p = init.state.projects[0], asset = p.records[0];
  const headers = {"Content-Type":"application/json","X-Brain-Token":init.token};
  async function upload(filename) {
    const jpeg = await fs.readFile(path.join(__dirname,"ui","art",filename), "base64");
    const response = await fetch(url + "/api/preview", {method:"POST", headers, body:JSON.stringify({jpeg})});
    assert.equal(response.status, 200);
    return (await response.json()).preview;
  }
  const startImage = await upload("lantern-narrow.jpg"), finalImage = await upload("lantern-wide.jpg");
  function revision(id, filename, label, preview, note, parent = "", tool = "bl") {
    return {id, path:"D:/test/" + filename, record:asset.id, tool, label, preview, note, parent, branch:"Main", comparisons:[]};
  }
  p.revisions = [
    revision("export-final", "Pen_Final.fbx", "Final", "", "Exported for engine", "export-start"),
    revision("blend-final", "Pen_Final.blend", "Final", finalImage, "Polished the cap", "blend-start"),
    revision("export-start", "Pen_Start.fbx", "Start", "", "First export"),
    revision("blend-start", "Pen_Start.blend", "Start", startImage, "Blocked out the nib"),
    revision("paint", "Pen.spp", "v001", "", "Painted brass", "blend-final", "sp"),
    revision("twin", "alternate/Pen_Final.blend", "Final", "", "Alternate folder")
  ];
  asset.graphPrefs = {format:".blend"};
  const saved = await fetch(url + "/api/save", {method:"POST", headers, body:JSON.stringify(init)});
  assert.equal(saved.status, 200, await saved.text());

  edge = spawn(browser, ["--headless=new","--disable-gpu","--disable-background-networking","--no-first-run","--no-default-browser-check","--window-size=1500,950","--remote-debugging-port=0","--user-data-dir=" + profile, url], {stdio:"ignore",windowsHide:true});
  const portFile = path.join(profile, "DevToolsActivePort");
  const debugPort = await until(async () => (await fs.readFile(portFile, "utf8").catch(() => "")).split(/\s/)[0], "browser debugger");
  const page = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(target => target.url.startsWith(url)), "app tab");
  client = await devtools(page.webSocketDebuggerUrl);
  const ev = client.evaluate;
  await until(() => ev("typeof data !== 'undefined' && !!data"), "app startup");
  await ev(`localStorage.setItem(guideOnLaunch,"off"); openRecord(${JSON.stringify(asset.id)},"History")`);

  async function mouse(selector, button = "left", modifiers = 0) {
    const point = await ev(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:"nearest",inline:"nearest"});const b=el.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
    for (const type of ["mousePressed","mouseReleased"]) {
      const buttons = type === "mouseReleased" ? 0 : button === "right" ? 2 : 1;
      await client.send("Input.dispatchMouseEvent", {type, button, buttons, modifiers, clickCount:1, ...point});
    }
  }
  const selected = () => ev("[before.value,after.value]");
  const node = name => `.rev-face[title="D:/test/${name}"] strong`;
  const open = (tab, more = {}) => ev(`openRecord(${JSON.stringify(asset.id)},${JSON.stringify(tab)},${JSON.stringify(more)})`);


  async function drag(from,to,button="left",modifiers=0) {
    const buttons=button==="middle"?4:1;
    await client.send("Input.dispatchMouseEvent",{type:"mousePressed",button,buttons,modifiers,clickCount:1,...from});
    await client.send("Input.dispatchMouseEvent",{type:"mouseMoved",button,buttons,modifiers,...to});
    await client.send("Input.dispatchMouseEvent",{type:"mouseReleased",button,buttons:0,modifiers,clickCount:1,...to});
  }
  const keypress=async(key,modifiers=0)=>{for(const type of ["keyDown","keyUp"])await client.send("Input.dispatchKeyEvent",{type,key,modifiers})};
  await mouse('[data-zoom="fit"]');
  const box=await ev(`(() => {const el=document.querySelector('.rev-card'), b=el.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height}})()`);
  await drag({x:box.x-6,y:box.y-6},{x:box.x+box.w/2,y:box.y+box.h/2});
  assert.equal(await ev("locationState.compareSelection.length"),1);
  await keypress("a",2);
  assert.equal(await ev("locationState.compareSelection.length"),3);
  const first=await ev("document.querySelector('.rev-card').getBoundingClientRect().toJSON()");
  await drag({x:first.x+30,y:first.y+30},{x:first.x+60,y:first.y+55});
  await until(()=>ev("!busy && project().revisions.filter(v=>v.canvas).length===3"),"one group move");
  await ev("travelEdit('undo')");
  assert.equal(await ev("project().revisions.filter(v=>v.canvas).length"),0);
  await ev("document.querySelector('.graph-scroll').focus()");
  await keypress("Escape");
  assert.equal(await ev("locationState.compareSelection.length"),0);
  assert.equal(await ev("detectSoftware(project(),'D:/water/river.LIQUIGEN')"),"JangaFX LiquiGen");
  assert.equal(await ev("detectSoftware(project(),'D:/terrain/Level.TERRAIN')"),"Gaea");
  assert.equal(await ev("fileExt('Fx/smoke.v003.BGEO.SC')"),".bgeo.sc");
  assert.equal(await ev("detectSoftware({tools:[]},'D:/exports/tree.fbx')"),"");
  assert.equal(await ev("detectSoftware({tools:[{name:'Maya',folders:['D:/Maya'],extensions:'.fbx'}]},'D:/Maya/export.fbx')"),"Maya");
  await mouse(node("Pen_Start.blend"), "right");
  assert.equal(await ev("dialog.open && $('#dialogTitle').textContent"), "Edit revision");
  await mouse("#cancel");
  await mouse(node("Pen_Start.blend"), "left", 2);
  await mouse(node("Pen_Start.blend"), "left", 2);
  assert.equal(await ev("document.querySelectorAll('[data-compare-side]').length"), 0);
  await mouse(node("Pen_Final.blend"), "left", 2);
  await mouse(node("Pen_Start.blend"), "left", 2);
  assert.deepEqual(await ev("locationState.compareSelection"), ["blend-final","blend-start"]);
  await mouse(node("Pen_Start.blend"), "right");
  assert.equal(await ev("document.querySelector('.compare-menu:popover-open button').textContent"), "Compare revisions");
  await mouse(".compare-menu button");
  const pair = ["blend-final","blend-start"];
  assert.deepEqual(await selected(), pair);
  await until(() => ev("[...document.querySelectorAll('img.comparepic')].filter(img=>img.naturalWidth>0).length===2"), "both saved images");
  assert.deepEqual(await ev("[...document.querySelectorAll('.compare-pane')].map(p=>[p.querySelector('img.comparepic').getAttribute('src'),p.querySelector('.text').textContent])"),
    [[finalImage,"Polished the cap"],[startImage,"Blocked out the nib"]]);
  const [left, right] = await ev("[...document.querySelectorAll('.compare-pane')].map(p=>p.getBoundingClientRect().toJSON())");
  assert.equal(left.top, right.top);
  assert.ok(left.right <= right.left);
  await client.send("Page.reload");
  await until(() => ev("!!document.querySelector('#after')"), "restored comparison");
  assert.deepEqual(await selected(), pair);

  await open("Compare");
  assert.deepEqual(await selected(), ["blend-start","blend-final"]);
  await open("Compare", {before:"export-final", after:"paint"});
  assert.deepEqual(await selected(), ["export-final","paint"]);
  assert.deepEqual(await ev("[...document.querySelectorAll('.compare-pane .text')].map(x=>x.textContent)"), ["Exported for engine","Painted brass"]);
  assert.match(await ev("document.querySelector('.compare-pane .placeholder').textContent"), /Pen_Final\.fbx/);
  await open("Compare", {revision:"paint"});
  assert.deepEqual(await selected(), ["blend-final","paint"]);
  await ev("$('#before').value='twin';$('#before').dispatchEvent(new Event('change'))");
  assert.equal(await ev("document.querySelector('.compare-pane .text').textContent"), "Alternate folder");
  assert.match(await ev("before.selectedOptions[0].textContent"), /alternate\/Pen_Final\.blend/);
  await open("Compare", {before:"no-longer-here", after:"paint"});
  assert.deepEqual(await selected(), ["","paint"]);
  assert.match(await ev("$('#content').textContent"), /no longer in this asset/);
  await open("Compare", {before:"blend-final", after:"paint"});
  const noteTops = await ev("[...document.querySelectorAll('.compare-pane h3')].map(h=>h.getBoundingClientRect().top)");
  assert.equal(noteTops[0], noteTops[1]);
  await ev("find(project().revisions,'blend-final').preview='/media/'+ '0'.repeat(32);render()");
  await until(() => ev("document.querySelector('.compare-pane .placeholder')?.textContent.includes('load the saved preview')"), "missing image message");
  assert.deepEqual(await selected(), ["blend-final","paint"]);
  assert.equal(await ev("document.querySelector('.compare-pane .text').textContent"), "Polished the cap");

  // Only this temporary library uses controlled model replies. Backend tests check the actual API payloads.
  await client.send("Page.reload");
  await until(()=>ev("!!document.querySelector('#after')"),"saved workspace");
  await open("Compare",{before:"blend-start",after:"blend-final"});
  await ev(`hasKey=true;const realPost=post;post=async(route,body)=>{
    if(route!=="ai")return realPost(route,body);
    if(body.mode==="highlight")return {model:"muse-spark-1.3",summary:"The cap changed.",changes:[{part:"Cap",detail:"Wider cap",before:[50,80,350,700],after:[60,90,400,750]}],beforePreview:find(project().revisions,body.before).preview,afterPreview:find(project().revisions,body.after).preview};
    if(body.mode==="locate")return {box:[10,10,100,100],model:"sam-3.1"};
    if(body.mode==="trace")return {status:"likely",summary:"A visible match.",matches:[{revisions:["blend-final"],evidence:"Same cap."}]};
    throw Error("Unexpected model action")
  }`);
  await mouse("[data-highlight]");
  await until(()=>ev("document.querySelectorAll('.visual-preview rect').length===2"),"paired visual overlays");
  assert.match(await ev("$('#diff').value"),/Wider cap/);
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save comparison').click()");
  await until(()=>ev("!!find(project().revisions,'blend-final').comparisons[0]?.visual"),"saved visual findings");
  await open("History");
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Trace screenshot').click()");
  await ev(`(async()=>{const file=new File([await (await fetch('/art/lantern-wide.jpg')).blob()],'engine.jpg',{type:'image/jpeg'});await assignScreenshot($('#tracePane [data-image-target]'),file)})()`);
  await until(()=>ev("!document.querySelector('.trace-crop').hidden"),"pasteable trace screenshot");
  await mouse(".trace-crop canvas");
  await until(()=>ev("!document.querySelector('.trace-box').hidden"),"SAM crop");
  await mouse("[data-trace]");
  await until(()=>ev("!!document.querySelector('.trace-result button')"),"visual trace evidence");
  await ev("[...document.querySelectorAll('#tracePane button')].find(b=>b.textContent==='Save to Sources & decisions').click()");
  await until(()=>ev("!!record().sources?.find(s=>s.traceImage)"),"saved screenshot evidence");
  await mouse(".trace-result button");
  assert.equal(await ev("locationState.revision"),"blend-final");
  await open("Overview");
  await mouse(".saved-trace summary");
  await until(()=>ev("document.querySelector('img.saved-trace-pic')?.naturalWidth>0"),"stored region");
  await mouse(".saved-trace button");
  assert.equal(await ev("locationState.revision"),"blend-final");
  await open("Compare",{before:"blend-start",after:"blend-final"});
  await until(()=>ev("document.querySelectorAll('.visual-preview rect').length===2"),"restored saved evidence");

  await open("History");
  await ev("document.querySelector('.graph-scroll').focus()");
  await keypress("a",2);
  await mouse(node("Pen_Start.blend"),"right");
  assert.equal(await ev("document.querySelector('.compare-menu small').textContent"),"3 revisions selected");
  await ev("[...document.querySelectorAll('.compare-menu button')].find(b=>b.textContent.startsWith('Remove selected')).click()");
  assert.match(await ev("$('#fields').textContent"),/Remove 3 revisions and 1 saved comparison/);
  await mouse("#cancel");
  assert.equal(await ev("project().revisions.length"),6);
  await ev("document.querySelector('.graph-scroll').focus()");
  await keypress("Delete");
  await mouse("#submit");
  await until(()=>ev("!busy && !dialog.open && project().revisions.length===3"),"group removal");
  assert.equal(await ev("find(project().revisions,'paint').parent"),"");
  await ev("travelEdit('undo')");
  assert.equal(await ev("find(project().revisions,'paint').parent"),"blend-final");
  assert.equal(await ev("find(project().revisions,'blend-final').comparisons.length"),1);

  await ev(`for(let i=0;i<8;i++)document.querySelector('[data-zoom="+"]').click();document.querySelector('.graph-scroll').scrollTo(0,0)`);
  const canvas=await ev("document.querySelector('.graph-scroll').getBoundingClientRect().toJSON()");
  const nearEdge={x:canvas.right-18,y:canvas.top+100};
  await client.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",buttons:1,clickCount:1,x:canvas.x+5,y:canvas.y+5});
  await client.send("Input.dispatchMouseEvent",{type:"mouseMoved",button:"left",buttons:1,...nearEdge});
  await until(()=>ev("document.querySelector('.graph-scroll').scrollLeft>20"),"edge scrolling during marquee");
  await keypress("Escape");
  await client.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",buttons:0,clickCount:1,...nearEdge});
  assert.equal(await ev("document.querySelector('.graph-marquee').hidden"),true);

  await ev("revisionForm(null,{record:record().id});$('#path').value='D:/terrain/Cliffs_v004.TERRAIN';$('#path').dispatchEvent(new Event('change'))");
  assert.deepEqual(await ev("[$('#tool').selectedOptions[0].textContent,val('discipline'),val('label')]"),["Gaea","Terrain & foliage","v004"]);
  await mouse("#submit");
  await until(()=>ev("!busy && !dialog.open && project().revisions.some(v=>v.path.endsWith('.TERRAIN'))"),"native project file registered");
  assert.equal(await ev("toolName(project().revisions.find(v=>v.path.endsWith('.TERRAIN')).tool)"),"Gaea");

  await client.send("Page.navigate",{url:url+"/?demo=trace"});
  await until(()=>ev("document.querySelector('.trace-crop')?.hidden===false"),"example deep link");
  assert.equal(await ev("record().id"),"bird");
  assert.equal(await ev("location.search"),"");
  await mouse("[data-trace]");
  assert.equal(await ev("document.querySelector('.trace-key').open"),true);
  assert.equal(await ev("document.activeElement.matches('[data-key]')"),true);
  await ev("document.querySelector('[data-key]').value='isolated-test-session-key';document.querySelector('[data-connect]').click()");
  await until(()=>ev("hasKey && document.querySelector('.trace-key').hidden"),"inline session connection");
  assert.equal(await ev("document.querySelector('.trace-crop').hidden"),false);

});
