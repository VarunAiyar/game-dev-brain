"""Game Dev Brain viewport checkpoint. Install this file from Blender Preferences."""
bl_info={"name":"Game Dev Brain – Capture checkpoint","author":"Game Dev Brain",
         "version":(1,0,0),"blender":(4,2,0),"category":"3D View",
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
OPTIONS=[]


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
            reason="Restart Game Dev Brain to load Blender capture support."
        raise RuntimeError(reason) from err
    except OSError as err:
        raise RuntimeError("Start Game Dev Brain on port 48731, then try again.") from err


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


def choices(self,context):
    return OPTIONS


class GDB_OT_checkpoint(bpy.types.Operator):
    bl_idname="gdb.capture_checkpoint"
    bl_label="Game Dev Brain: Capture Checkpoint"
    bl_options={'INTERNAL'}
    destination: bpy.props.EnumProperty(name="Destination",items=choices)

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
                raise RuntimeError("Create a project in Game Dev Brain first.")
            dirty=bpy.data.is_dirty
            self.payload=dict(viewport(context),mode="save",id=uuid.uuid4().hex,path=self.path,
                              object=context.active_object.name if context.active_object else "",
                              context=context.mode,dirty=dirty)
            if routes["automatic"]:
                return self.store(self.targets[0])
            OPTIONS[:]=[(str(i),t["label"],"") for i,t in enumerate(self.targets)]
            self.destination="0"
            return context.window_manager.invoke_props_dialog(self,width=470)
        except Exception as exc:
            self.report({'ERROR'},str(exc))
            return {'CANCELLED'}

    def draw(self,context):
        self.layout.label(text="Choose where this viewport checkpoint belongs.")
        self.layout.prop(self,"destination")

    def execute(self,context):
        try:
            return self.store(self.targets[int(self.destination)])
        except Exception as exc:
            self.report({'ERROR'},str(exc))
            return {'CANCELLED'}

    def store(self,target):
        reply=request("/api/checkpoint",dict(self.payload,project=target["project"],source=target["source"]),self.token)
        self.report({'INFO'},"Captured · "+reply["label"]+" · Undo in Game Dev Brain")
        return {'FINISHED'}


def menu(self,context):
    self.layout.operator(GDB_OT_checkpoint.bl_idname, text="Game Dev Brain: Capture Checkpoint")


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
