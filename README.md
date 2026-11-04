# Game Dev's Best Friend

Double-click **Start Game Dev's Best Friend.cmd**. The app opens in your browser. Keep its console open while you work. Requires Python 3.10+ on Windows. No package installation is needed.

### Capture a revision from Blender

1. Start the app on the same Windows PC as Blender and open **Open Project Library**. If the [local app](http://127.0.0.1:48731/) is already running on port 48731, use that instance.
2. In Blender **4.2 or later**, open **Edit → Preferences → Add-ons → Install from Disk**. Select the [add-on file from this repository](blender/game_devs_best_friend.py), or download it from **History → Blender capture setup** in the app. Enable **Game Dev's Best Friend – Capture checkpoint**. If you installed the earlier **Game Dev Brain** add-on, disable that copy first.
3. Save a file such as `Pen_v001.blend`. Hover over the **3D View** and press **Ctrl+Alt+Shift+C**. For a new file, choose your **Project**, **Asset**, **Source node**, and **Branch**. You can also use **View → Game Dev's Best Friend: Capture Checkpoint** in the viewport.
4. Look for **Captured** in Blender. Switch to the app and choose **Open checkpoint** in the notification, or open the asset’s **History**, select its Blender node, and look under **Blender checkpoints**.
5. Edit the model and capture again. You should see two timestamped viewports on the same revision. To test a linked revision, use **Save As** to create `Pen_v002.blend` in the same folder and capture again. The graph should connect v001 to v002.

For a blockout-to-high-poly workflow, choose the existing asset and its blockout as the **Source node**. Keep the branch name to continue it, or enter **High poly** to start an experiment from that node. The source can be a screenshot-only node, and the new Blender file can have a different name or live in another folder. Choose **Independent node** when the source is unknown. Choose **Create new asset** only when the file belongs to a separate asset. A file already tracked in Blender adds another checkpoint to its existing node.

Update an older add-on by installing the current file from `blender/game_devs_best_friend.py` again and restarting Blender if it is still showing the old destination dialog.

Local capture works without a Meta key. For automatic AI notes, connect your key in the app. To also see SAM outlines, run [Setup Blender Capture.cmd](Setup%20Blender%20Capture.cmd) once. It installs the pinned mask decoder beside the app using [requirements-capture.txt](requirements-capture.txt).

Each checkpoint stores the viewport, timestamp, active object, mode, and saved file path locally. The shortcut captures the current viewport even when edits are unsaved. It never saves over the Blender file. Undo a capture in Game Dev's Best Friend.

With a key connected, the first viewport gets a Muse Spark baseline note. Later checkpoints compare against the previous screenshot. Muse Spark describes visible changes and proposes a region. When a changed part is visible in the new image, SAM 3.1 segments it and the inspector draws the decoded mask. Only viewport images and prompts go to Meta. The artist’s own quick note stays separate. A change of camera angle can make comparisons inconclusive. Offline captures can be analyzed later in the checkpoint inspector.

Muse Spark uses low reasoning effort with a 4,096-token output budget for every action, including the first checkpoint note. If Meta reports that the output limit was reached, the app retries once with 8,192 tokens. It accepts only a completed answer. Existing failed checkpoints can be retried with **Analyze again** using their saved screenshots.

On launch, enter your game’s name. A new name creates a project immediately. An existing name opens that project’s setup. Pick a role, adjust its disciplines and tools, then add a working folder for any software you use. You can leave the others empty. Choose **Open Project Library** at any step to return to your workspace. **Practice the basics** under **Asset library → Project guide** runs the three hands-on exercises.

**Review the scan.** The app groups versions by asset, software and discipline. Edit each proposed asset, classification, badge and note before saving. Use the same asset name for rigging and modeling. Pick a source version if you know the handoff. Choose formats per folder. Blender defaults to `.blend`. Select `.fbx` when you also want exports. Each format has its own series in the scan and row in the graph. Numbered files sort naturally, including versions with test names after the number. Matching `_Start` and `_Final` files appear in one asset in that order. Installation folders serve as shortcuts. Only project folders are scanned.

Click the Game Dev's Best Friend logo to return to the opening screen. **How Game Dev's Best Friend helps** walks through folder tracking, revision branches and visual review. Its [three examples](http://127.0.0.1:48731/?view=help#examples) cover the branch editor, screenshot trace and revision comparison. The branch editor offers a guided example project or a shorter tour after setting up your own project. Each guide can be closed with **×**.

## Revision graph

Open an asset in **Asset library**. Its Blender source, textures, engine imports and other working files can each stay in a different folder.

- **Add files** opens a multi-select picker. Use **More files** to add another folder’s files before saving. Each file has its own software, version, branch and note.
- Drop files on the dotted canvas to track them. Drop them on a card to preselect that version as their source. The review looks for matching names, sizes and modification times in linked folders and directories containing tracked files. Check the proposed paths. For an unknown or ambiguous path, choose the original.
- **Bring tracked file** joins a file from another asset in this project. The review lists the impact on linked revisions. Picking the same path through **Add files** also reuses its saved revision.
- Hover or focus **ⓘ** beside a field for an example. Under **Graph settings**, choose filename first, version first or version only and filter by file type. **Node color** overrides the software tint on a selected card.
- Use **Edit class path** to enter `NPCs / NPC Wildlife / Neutral`. Each asset has a single history across disciplines. Select a revision and **Mark engine ready** to identify the exact deliverable.
- Use **Earlier** and **Later** to change version order within a branch and format. Reversing a directly connected pair shows which source arrow will change.
- Ctrl-click the **Before** card, then Ctrl-click the **After** card. Right-click either and choose **Compare revisions**. Each side shows that file’s preview and quick note. Ctrl-click a marked card to deselect it, or press Esc on the canvas to clear both.
- Left-drag empty canvas to box-select. Hold near a canvas edge to scroll into longer branches. Shift-drag adds cards. Ctrl-click toggles individual cards. Drag any selected card to move the group in one undo step. Ctrl+A selects visible cards, Esc clears, and Delete previews removal from history.
- Middle-drag or Alt+left-drag to pan. Ctrl+wheel zooms at the pointer. Press F to frame the selection, or use **Fit** for the whole graph. Right-click a selection for its actions.
- Drag a card’s right handle to another card to set its source. Drag into empty space or choose **New branch** to fork. The **+** on a connection inserts a revision between its endpoints. Solid arrows record a source. Dotted lines show version order.
- Hover a card to write a quick note, or edit **Quick note** in the inspector. Use **Delete branch** there to review removal. **Undo** restores a saved graph edit.

The library records paths, previews, notes and handoffs locally. Keep separate version files when you need to reopen earlier contents. Engine repository commits remain part of your existing version-control workflow.

## Working files and exports

Onboarding and **Project settings** include **VFX & simulation** and **Terrain & foliage**. Folder setup offers native project files first and lets you opt into exchange files and caches. Examples include EmberGen `.ember`, LiquiGen `.liquigen`, IlluGen `.illugen`, GeoGen `.geogen`, Gaea `.terrain` and legacy `.tor`, and Houdini `.hipnc` and `.bgeo.sc`. Detection uses the full suffix, linked folders, native formats and project context. Choose the creator when a shared format such as `.fbx` has several plausible tools. **Software & folders → Add software** accepts custom extensions and offers catalog presets.

## Your project

- Open **Project settings** in the sidebar to add a discipline such as **2D Sprites**. Expand **Software**, pick the apps you use, and save. Use **Software & folders** to link their working directories.
- On **Asset library**, choose **+ Root class** to start a group. Use **+** beside a class to nest another. **Edit** lets you rename it, choose a parent within its project section, reorder it, or delete it. Deleting a class moves its contents up one level. **Undo** restores the tree.
- Select a revision and press **Ctrl+V** to save a screenshot as its image. In an asset or revision form, paste into **Preview image** and choose **Save**. During a folder import, click the target asset’s preview field before pasting.

Use **Undo / Redo** above each page for the last 40 saved library changes, including imports and removals. History survives restarting the app. Ctrl+Z and Ctrl+Shift+Z work outside text fields. In class and section editors use **×**, **Undo field** or **Redo field** before saving.

**Add record → Browse project file** lets you select the source file, choose its software and save the first revision with the new record. The preview image is optional. The default art sections are **2D Sprites**, **3D Modeling** and **Texturing**.

1. Choose **New project**, then **Project sections → New section**. Name a section and add fields. A Reference field can point to records from a particular section or class.
2. Inside a section, choose **New class** or **Add record**. Use **Reference record** to link an existing asset and describe its role.
3. Under **Software & folders**, register a tool and extensions. Link a folder and **Scan folders**. Choose **Track file**, or **Suggest record** to ask Meta for a candidate to review. **Across projects** searches all tracked revisions.
4. Choose a revision label, branch, source revision, and optional screenshot. Use **Fork from here** for experiments or cross-tool handoffs. A source path points to the original file. Keep separately saved files for versions you need to reopen. The app stores preview snapshots and notes.
5. In **Compare**, choose two revisions. Save your own comparison or generate and edit an AI draft. The artist note stays with its own revision.

In **History → Manage branches**, drag lanes or use Up and Down. Rename a branch, expand its revisions to move one, or preview a removal. Removing a source clears that handoff on surviving children. **Undo removal** is available in that window until the next save or reload.

## Runtime Meta AI

Open **Connect Meta AI**, enter your key, and save. Alternatively set the environment variable **MODEL_API_KEY** before launch. Session keys stay in server memory. Stop the server to clear them.

| Action | Data sent to Meta | Result |
|---|---|---|
| Ask Meta to organize | Sample filenames and nearby folders, selected tools, tasks and existing asset names | Editable suggestions for canonical asset, discipline, type and classification. Available during a scan with a key or on demand in review. |
| Studio assistant during practice and setup | Current lesson and coaching question | A short live introduction or contextual answer. The guided exercises work without a key. |
| Highlight changes | The two selected revision previews, in order | Muse Spark 1.3 identifies visible changes with independent markers on each image. Save comparison to keep the markers and text on that pair. |
| Click a subject in Trace screenshot | The pasted frame and a point in image pixels | SAM 3.1 locates the object and supplies its crop bounds. The artist can adjust the crop manually. |
| Find matching revisions | The selected crop and up to eight candidate revision previews, without filenames or notes | Muse Spark 1.3 explains the visible evidence. Results link to graph nodes and preserve ties when revisions share a screenshot. Save the crop and findings under the asset’s Sources & decisions. |
| Generate AI draft | Two selected JPEG previews | Editable visible-change note saved against that revision pair |
| Suggest record | Discovered filename, software name, record names, descriptions, and tracked filenames | Reviewable asset suggestion with a reason |
| Draft decision with Meta | The excerpt selected in Attach a source | Editable decision, proposal or next check kept with the original excerpt |
| Ask this project | Current project's record text, references, custom values, saved decisions, revision names, comparisons and artist notes | Answer grounded in the project history |

The Python server calls Meta’s Responses API at **https://api.meta.ai/v1/responses**. Visual review, revision matching and text actions use **muse-spark-1.3**. Point-based cropping uses **sam-3.1**. Compare accepts artist-supplied screenshots for any tool. [Meta image-understanding documentation](https://dev.meta.ai/docs/image-understanding)

### Try the visual demo

The two guided examples use bundled illustrative artwork. Opening an example loads its revision graph. Model calls begin when you request analysis.

1. [Trace the Ridgeback raptor](http://127.0.0.1:48731/?demo=trace). Open screenshot trace, click the hunter for a SAM crop or drag a box, then match the crop against three Blender revision previews. Save the match evidence under **Sources & decisions**. A match is a visual identification, and the model can return an uncertain result.
2. [Review the Tidebreaker floodgate](http://127.0.0.1:48731/?demo=compare). Open **Compare**, choose **Highlight changes**, inspect the marked areas on the blockout and lockdown previews, then edit and save the note on that revision pair.

[Meta image grounding](https://dev.meta.ai/docs/image-understanding) · [SAM point prompts and segmentation](https://dev.meta.ai/docs/sam/segmenting)

## Storage

Software artwork is bundled locally. Some services use their vendor mark. Sources include [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons), [Icons8](https://icons8.com), installed application icons and publisher website icons. The per-icon source list is in **ui/art/software-icon-sources.txt**.

Project data and imported previews are stored in **library/brain.sqlite3** beside the app. Close the server before copying that folder for backup. Scan on demand or enable **Auto-scan** to refresh every 12 seconds while that software view is visible. Scans include subfolders and leave source files in place. Registered software identifies a workflow. Open file uses the Windows file association. For other file types choose Show in folder.

To run without opening a browser, use `python app.py --no-browser` and visit **http://127.0.0.1:48731/**. For a separate library use `python app.py --data "D:\My Brain Library" --port 48732`.

## Tests

Run `python -m unittest -q` for the backend and `node --test test_compare.cjs` for the comparison workflow. The browser test uses Node 22+, Python, and headless Edge with a temporary library and profile. Set `EDGE_PATH` if Edge is installed in a custom location.

Run `blender --background --factory-startup --python-exit-code 1 --python blender/test_checkpoint_picker.py` to check the add-on's project, asset, source, and branch selectors using Blender's own property system. This test sends a mocked capture request. The viewport screenshot and physical shortcut need an interactive Blender check.
