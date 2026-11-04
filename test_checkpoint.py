import base64
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app
from capture_vision import review


class CaptureTest(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        for name,value in (("DATA",self.root/"db"),("SESSION_KEY","")):
            mock=patch.object(app,name,value);mock.start();self.addCleanup(mock.stop)
        env=patch.dict(app.os.environ,{"MODEL_API_KEY":""});env.start();self.addCleanup(env.stop)
        app.initialize()
        self.image=base64.b64encode(app.preview_bytes("/art/lantern-wide.jpg")).decode()

    def capture(self,name,id,**kwargs):
        path=self.root/name;path.touch()
        route=app.checkpoint_action({"mode":"route","path":str(path)})
        data=dict(mode="save",id=id*32,jpeg=self.image,size=[640,400],path=str(path),**route["choices"][0])
        return app.checkpoint_action(dict(data,**kwargs))

    def test_checkpoint_repeat_save_as_and_undo(self):
        one=self.capture("Pen_Start.blend","a")
        two=self.capture("Pen_Start.blend","b")
        self.assertEqual(one["revision"],two["revision"])
        self.assertEqual(two,self.capture("Pen_Start.blend","b"))
        three=self.capture("Pen_Final.blend","c")
        snap=app.snapshot()
        p=app.by_id(snap["state"]["projects"],one["project"])
        start=app.by_id(p["revisions"],one["revision"]);final=app.by_id(p["revisions"],three["revision"])
        self.assertEqual(len(start["checkpoints"]),2)
        self.assertEqual(final["parent"],start["id"])
        self.assertEqual(final["checkpoints"][0]["before"],start["preview"])
        self.assertEqual(final["note"],"")
        self.assertEqual(app.checkpoint_action({"mode":"result","id":three["id"]})["status"],"offline")
        state=app.travel("undo",snap["version"])["state"]
        self.assertFalse(any(v["id"]==final["id"] for v in state["projects"][0]["revisions"]))

    def test_ambiguous_project_requires_choice(self):
        path=self.root/"Prop_v1.blend";path.touch()
        snap=app.snapshot()
        for p in snap["state"]["projects"]:
            next(t for t in p["tools"] if t["name"]=="Blender")["folders"]=[str(self.root)]
        app.commit(snap)
        route=app.checkpoint_action({"mode":"route","path":str(path)})
        self.assertFalse(route["automatic"])
        self.assertEqual(len(route["choices"]),2)

    @unittest.skipUnless(importlib.util.find_spec("meta_sam_parser"),"install requirements-capture.txt to test SAM decoding")
    def test_model_note_and_actual_mask_decoder(self):
        cp={"id":"a","before":"left","preview":"right","size":[100,100]}
        diff={"summary":"A wider clip.","changes":[{"part":"Clip","detail":"Edge extends out.","after":[0,0,500,500]}]}
        def segment(content,key,model):
            self.assertEqual(model,"sam-3.1")
            self.assertIn("box;x1=0;y1=0;x2=50;y2=50",content[0]["text"])
            return {"text":"<0f>1<|box;x1=4;y1=6;x2=40;y2=42;w=100;h=100|><|mask;x=0;y=0;data=2,2,!!!!!&MoT/:|>"}
        out=review(cp,"test",lambda *args:diff,lambda ref:b"jpeg",segment,app.image_block)
        self.assertIn("Edge extends out",out["note"])
        self.assertEqual(out["mask"]["box"],[4,6,37,37])
        self.assertTrue(out["mask"]["path"])

    def test_no_change_skips_segmentation(self):
        diff={"summary":"No visible change.","changes":[]}
        cp={"before":"a","preview":"b"}
        self.assertEqual(review(cp,"test",lambda *args:diff,None,None,None)["note"],diff["summary"])
