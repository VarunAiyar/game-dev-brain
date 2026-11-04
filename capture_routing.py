"""Route Blender captures using recorded paths. Ambiguous destinations are explicit choices."""
import re
import uuid
from pathlib import Path
from sample import record, section, tool, rev


def uid():
    return uuid.uuid4().hex


def series(path):
    stem = Path(path).stem
    match = re.search(r"(?:^|[ ._-])(v\d+(?:\.\d+)*|start|final)(?=$|[ ._-])", stem, re.I)
    name = stem[:match.start()] if match else stem
    return (name.strip(" _-.") or Path(path).parent.name), match[1] if match else "Initial"


def pathkey(path):
    return str(Path(path)).replace("\\", "/").rstrip("/").casefold()


def rank(label):
    value = label.lower()
    if value in ("start", "initial"):
        return (0,)
    if value == "final":
        return (2,)
    if re.fullmatch(r"v\d+(?:\.\d+)*", value):
        return (1, *map(int, value[1:].split(".")))
    return (3,)


def destinations(projects, path):
    key, folder = pathkey(path), pathkey(Path(path).parent)
    family, label = series(path)
    exact, related, linked, fallback = [], [], [], []
    for p in projects:
        tools = [t for t in p["tools"] if t["name"].casefold()=="blender"]
        records = {r["id"]:r for r in p["records"]}
        def option(v=None):
            name = records[v["record"]]["name"] if v else family
            return {"project":p["id"], "source":v["id"] if v else "",
                    "label":p["name"]+" / "+name+(" / "+v["branch"]+" / "+v["label"] if v else " (new asset)")}
        fallback.append(option())
        lanes = {}
        for v in p["revisions"]:
            src = v.get("path")
            if not src or v["tool"] not in {t["id"] for t in tools}:
                continue
            if pathkey(src)==key:
                exact.append(option(v))
            elif (Path(src).suffix.casefold()==".blend" and pathkey(Path(src).parent)==folder
                  and series(src)[0].casefold()==family.casefold()):
                lanes.setdefault((v["record"],v["branch"],v["tool"]),[]).append(v)
        for versions in lanes.values():
            older = [v for v in versions if rank(series(v["path"])[1])<rank(label)]
            if older:
                nearest=max(rank(series(v["path"])[1]) for v in older)
                related.extend(option(v) for v in older if rank(series(v["path"])[1])==nearest)
            else:
                # An older or same-numbered variant carries no evidence for a handoff.
                anchor=versions[0]
                branch=option(anchor)
                branch.update(independent=True,label=p["name"]+" / "+records[anchor["record"]]["name"]+
                              " / "+anchor["branch"]+" (independent revision)")
                related.append(branch)
        if any(key.startswith(pathkey(root)+"/") for t in tools for root in t.get("folders",[]) if root):
            linked.append(option())
    choices=exact or related or linked or fallback
    return list({(c["project"],c["source"]):c for c in choices}.values()),bool(exact or related or linked)


def attach(projects, target, path, checkpoint):
    p = next(p for p in projects if p["id"]==target["project"])
    source = next((v for v in p["revisions"] if v["id"]==target["source"]),None)
    v = source
    if source is None or pathkey(source["path"])!=pathkey(path):
        family,label=series(path)
        if source:
            owner,tid,branch=source["record"],source["tool"],source["branch"]
            discipline=source.get("discipline") or branch
        else:
            t=next((t for t in p["tools"] if t["name"].casefold()=="blender"),None)
            if not t:
                t=tool(uid(),"Blender",".blend")
                p["tools"].append(t)
            discipline=t.get("task") or "3D Modeling"
            sec=next((s for s in p["sections"] if s["name"]==discipline),None)
            if not sec:
                sec=section(uid(),discipline)
                p["sections"].append(sec)
            asset=record(uid(),family,sec["id"],"")
            p["records"].append(asset)
            owner,tid,branch=asset["id"],t["id"],discipline
        v=rev(uid(),owner,tid,label,branch,source["id"] if source and not target.get("independent") else "","","")
        v.update(path=str(path),discipline=discipline)
        p["revisions"].append(v)
    previous="" if target.get("independent") else (source or {}).get("preview","")
    if not previous and v.get("parent"):
        previous=next((a.get("preview","") for a in p["revisions"] if a["id"]==v["parent"]),"")
    checkpoint["before"]=previous
    v.setdefault("checkpoints",[]).append(checkpoint)
    v["preview"]=checkpoint["preview"]
    return p,v
