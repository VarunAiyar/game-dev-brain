"""Run with Blender --background --factory-startup --python-exit-code 1 --python this_file."""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import game_devs_best_friend as addon


def target(project, asset, source, branch="Modeling"):
    return dict(project=project, record=asset, source=source, branch=branch,
                projectName=project, recordName=asset or "New sculpt",
                sourceLabel=source or "Independent node", label=f"{project}/{asset}/{source}")


sent = []
original_execute = addon.GDB_OT_checkpoint.execute


def exercise(self, context):
    self.targets = [
        target("game-a", "", ""),
        target("game-a", "character", ""),
        target("game-a", "character", "blockout"),
        target("game-a", "character", "rig", "Rigging"),
        target("game-b", "prop", ""),
        target("game-b", "prop", "model"),
        target("game-b", "", ""),
    ]
    addon.prepare_choices(self, self.targets)
    assert self.project == "game-a"
    assert self.asset == "character", self.asset
    assert self.destination == "1", self.destination
    self.destination = "2"
    assert self.branch == "Modeling"
    self.destination = "3"
    assert self.branch == "Rigging"
    self.project = "game-b"
    assert self.asset == "prop"
    assert self.destination == "4"
    self.asset = "__new__"
    assert self.destination == "6"
    self.project = "game-a"
    self.asset = "character"
    self.destination = "2"
    self.branch = "High poly"
    self.payload = {"mode":"save", "path":"D:/HighPoly.blend"}
    self.token = "test"
    assert original_execute(self, context) == {"FINISHED"}
    assert sent[-1] == dict(self.payload, project="game-a", record="character",
                            source="blockout", branch="High poly")
    return {"FINISHED"}


def capture_request(route, body, token):
    assert route == "/api/checkpoint"
    sent.append(body)
    return {"label":"High poly"}


addon.GDB_OT_checkpoint.execute = exercise
addon.GDB_OT_checkpoint.poll = classmethod(lambda cls, context: True)
addon.request = capture_request
addon.register()
try:
    assert bpy.ops.gdb.capture_checkpoint() == {"FINISHED"}
    assert bpy.ops.gdb.capture_checkpoint() == {"FINISHED"}
    print("Blender destination picker and capture payload passed.")
finally:
    addon.unregister()
