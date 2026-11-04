"""Game Dev's Best Friend viewport checkpoint. Install this file from Blender Preferences."""
bl_info={"name":"Game Dev's Best Friend – Capture checkpoint","author":"Game Dev's Best Friend",
         "version":(1,1,0),"blender":(4,2,0),"category":"3D View",
         "description":"Capture your saved .blend path and current viewport with Ctrl+Alt+Shift+C"}

import base64
import json
from pathlib import Path
import tempfile
import urllib.error
import urllib.request
import uuid

import bpy

ORIGIN="http://127.0.0.1:48731"
KEYMAPS=[]
# Blender requires enum strings returned by callbacks to remain alive.
OPTIONS={"projects":[], "assets":{}, "sources":{}, "targets":[]}


def request(route,body=None,token=None):
    headers={"Content-Type":"application/json"}
    if token:
        headers["X-Brain-Token"]=token
    req=urllib.request.Request(ORIGIN+route,data=json.dumps(body).encode() if body else None,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=5) as response:
            return json.load(response)
    except urllib.error.HTTPError as err:
        try:
            reason=json.load(err)["error"]
        except (ValueError,KeyError):
            reason="Restart Game Dev's Best Friend to load Blender capture support."
        raise RuntimeError(reason) from err
    except OSError as err:
        raise RuntimeError("Start Game Dev's Best Friend on port 48731, then try again.") from err


def viewport(context):
    with tempfile.TemporaryDirectory(prefix="brain-viewport-") as tmp:
        path=Path(tmp)/"viewport.png"
        if "FINISHED" not in bpy.ops.screen.screenshot_area(filepath=str(path)):
            raise RuntimeError("Could not capture this 3D View.")
        image=bpy.data.images.load(str(path),check_existing=False)
        try:
            w,h=image.size
            scale=min(1,1280/max(w,h))
            size=[max(1,round(w*scale)),max(1,round(h*scale))]
            if size!=[w,h]:
                image.scale(*size)
            jpeg=Path(tmp)/"viewport.jpg"
            image.filepath_raw=str(jpeg)
            image.file_format="JPEG"
            image.save()
            return {"size":size,"jpeg":base64.b64encode(jpeg.read_bytes()).decode("ascii")}
        finally:
            bpy.data.images.remove(image)


def project_choices(self,context):
    return OPTIONS["projects"]


def asset_choices(self,context):
    return OPTIONS["assets"].get(self.project,[])


def source_choices(self,context):
    return OPTIONS["sources"].get((self.project,self.asset),[])


def source_changed(self,context):
    if self.destination:
        self.branch=OPTIONS["targets"][int(self.destination)].get("branch","3D Modeling")


def asset_changed(self,context):
    items=source_choices(self,context)
    if items:
        self.destination=items[0][0]


def project_changed(self,context):
    items=asset_choices(self,context)
    if items:
        self.asset=items[0][0]


def prepare_choices(self,targets):
    OPTIONS["targets"]=targets
    OPTIONS["projects"].clear()
    OPTIONS["assets"].clear()
    OPTIONS["sources"].clear()
    for i,target in enumerate(targets):
        project=target["project"]
        asset=target["record"] or "__new__"
        if project not in OPTIONS["assets"]:
            OPTIONS["projects"].append((project,target["projectName"],""))
            OPTIONS["assets"][project]=[]
        if (project,asset) not in OPTIONS["sources"]:
            name=target["recordName"] if target["record"] else "Create new asset · "+target["recordName"]
            OPTIONS["assets"][project].append((asset,name,""))
            OPTIONS["sources"][project,asset]=[]
        OPTIONS["sources"][project,asset].append((str(i),target["sourceLabel"],target["label"]))
    # Keep creating another asset an explicit choice at the end of each list.
    for items in OPTIONS["assets"].values():
        items.sort(key=lambda item:item[0]=="__new__")
    preferred=targets[0]
    self.project=preferred["project"]
    if preferred["record"]:
        self.asset=preferred["record"]
        self.destination="0"


class GDB_OT_checkpoint(bpy.types.Operator):
    bl_idname="gdb.capture_checkpoint"
    bl_label="Game Dev's Best Friend: Capture Checkpoint"
    bl_options={'INTERNAL'}
    project: bpy.props.EnumProperty(name="Project",items=project_choices,update=project_changed)
    asset: bpy.props.EnumProperty(name="Asset",items=asset_choices,update=asset_changed)
    destination: bpy.props.EnumProperty(name="Source node",items=source_choices,update=source_changed)
    branch: bpy.props.StringProperty(name="Branch",default="3D Modeling",maxlen=160,
                                    description="Use the source node's branch, or name a new branch for this experiment")

    @classmethod
    def poll(cls,context):
        return context.area and context.area.type=='VIEW_3D'

    def invoke(self,context,event):
        if not bpy.data.filepath:
            self.report({'WARNING'},"Save this .blend file once before capturing.")
            return {'CANCELLED'}
        try:
            self.token=request("/api/capture-session")["token"]
            self.path=bpy.data.filepath
            routes=request("/api/checkpoint",{"mode":"route","path":self.path},self.token)
            self.targets=routes["choices"]
            if not self.targets:
                raise RuntimeError("Create a project in Game Dev's Best Friend first.")
            dirty=bpy.data.is_dirty
            self.payload=dict(viewport(context),mode="save",id=uuid.uuid4().hex,path=self.path,
                              object=context.active_object.name if context.active_object else "",
                              context=context.mode,dirty=dirty)
            if routes["automatic"]:
                return self.store(self.targets[0])
            if any("record" not in target for target in self.targets):
                raise RuntimeError("Restart Game Dev's Best Friend to load the updated destination picker.")
            prepare_choices(self,self.targets)
            return context.window_manager.invoke_props_dialog(self,width=570)
        except Exception as exc:
            self.report({'ERROR'},str(exc))
            return {'CANCELLED'}

    def draw(self,context):
        self.layout.label(text=Path(self.path).name,icon='FILE_BLEND')
        self.layout.label(text="Add this file as a revision in an asset's history.")
        self.layout.prop(self,"project")
        self.layout.prop(self,"asset")
        if self.asset!="__new__":
            self.layout.prop(self,"destination")
            self.layout.label(text="Choose the blockout or other version this file builds on.")
        self.layout.prop(self,"branch")

    def execute(self,context):
        try:
            return self.store(self.targets[int(self.destination)])
        except Exception as exc:
            self.report({'ERROR'},str(exc))
            return {'CANCELLED'}

    def store(self,target):
        destination=dict(project=target["project"],source=target["source"])
        if "record" in target:
            destination["record"]=target["record"]
        if self.branch.strip():
            destination["branch"]=self.branch.strip()
        reply=request("/api/checkpoint",dict(self.payload,**destination),self.token)
        self.report({'INFO'},"Captured · "+reply["label"]+" · Undo in Game Dev's Best Friend")
        return {'FINISHED'}


def menu(self,context):
    self.layout.operator(GDB_OT_checkpoint.bl_idname, text="Game Dev's Best Friend: Capture Checkpoint")


def register():
    bpy.utils.register_class(GDB_OT_checkpoint)
    bpy.types.VIEW3D_MT_view.append(menu)
    config=bpy.context.window_manager.keyconfigs.addon
    if config:
        km=config.keymaps.new(name="3D View",space_type='VIEW_3D')
        item=km.keymap_items.new(GDB_OT_checkpoint.bl_idname,'C','PRESS',ctrl=True,alt=True,shift=True)
        KEYMAPS.append((km,item))


def unregister():
    for km,item in KEYMAPS:
        km.keymap_items.remove(item)
    KEYMAPS.clear()
    bpy.types.VIEW3D_MT_view.remove(menu)
    bpy.utils.unregister_class(GDB_OT_checkpoint)
