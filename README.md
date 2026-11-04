# Game Dev Brain

Double-click **Start Game Dev Brain.cmd**. The app opens in your browser. Keep its console open while you work. Requires Python 3.10+ on Windows. No package installation is needed.

### Capture a revision from Blender

1. Run **Setup Blender Capture.cmd** once to install Meta’s mask decoder beside the app. Connect your Meta Model API key in Game Dev Brain for automatic analysis.
2. In **History → Blender shortcut**, download the add-on. In Blender **Preferences → Add-ons → Install from Disk**, select `game_dev_brain.py` and enable **Game Dev Brain – Capture checkpoint**.
3. Save a `.blend` file. With the pointer over a 3D View, press **Ctrl+Alt+Shift+C**. The same command is available in the viewport’s **View** menu. Keep Game Dev Brain running on its default port.
4. Capture again to add a timestamped checkpoint to the same revision. Save As a numbered sibling such as `Pen_v002.blend`, edit the viewport and capture to create a linked revision. An exact tracked file takes priority, followed by a version series in the same folder and linked Blender folders. Blender asks for a destination if it has no clear match.

Each checkpoint stores the viewport, timestamp, active object, mode, and saved file path locally. The shortcut captures the current viewport even when edits are unsaved. It never saves over the Blender file. Undo a capture in Game Dev Brain.

With a key connected, the first viewport gets a Muse Spark baseline note. Later checkpoints compare against the previous screenshot. Muse Spark describes visible changes and proposes a region. When a changed part is visible in the new image, SAM 3.1 segments it and the inspector draws the decoded mask. Only viewport images and prompts go to Meta. The artist’s own quick note stays separate. A change of camera angle can make comparisons inconclusive. Offline captures can be analyzed later in the checkpoint inspector.

On launch, enter your game’s name. A new name creates a project immediately. An existing name opens that project’s setup. Pick a role, adjust its disciplines and tools, then add a working folder for any software you use. You can leave the others empty. Turn off **Guide me on launch** to return straight to the workspace. **Practice the basics** under **Asset library → Project guide** runs the three hands-on exercises.

**Review the scan.** The app groups versions by asset, software and discipline. Edit each proposed asset, classification, badge and note before saving. Use the same asset name for rigging and modeling. Pick a source version if you know the handoff. Choose formats per folder. Blender defaults to `.blend`. Select `.fbx` when you also want exports. Each format has its own series in the scan and row in the graph. Numbered files sort naturally, including versions with test names after the number. Matching `_Start` and `_Final` files appear in one asset in that order. Installation folders serve as shortcuts. Only project folders are scanned.

**Brinefall → Asset library → Project guide** has five example tasks. Open **Compare the handles** to try a revision pair. **Canopy Run** shows an enemy referenced by a mechanic, playtest note and teaser.

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

With the app running on its default port, open [Trace the Canopy Run playtest frame](http://127.0.0.1:48731/?demo=trace) or [Compare the Brinefall lantern handles](http://127.0.0.1:48731/?demo=compare). Opening a demo loads local example images. The model runs when you click a subject or request analysis.

1. Use **Connect Meta AI** to set your key. In **Canopy Run**, open **Canopy sentry → History → Trace screenshot → Use example playtest frame**. Click the bird for a SAM crop, or drag a rectangle around it. Choose **Find matching revisions**, inspect the evidence, and follow a result into the graph.
2. In **Brinefall → Project guide → Compare the handles**, choose **Highlight changes**. Select a finding to see both regions, then **Save comparison**. These demos use the real API each time you request analysis. Existing notes and manual graph tools work offline.

[Meta image grounding](https://dev.meta.ai/docs/image-understanding) · [SAM point prompts and segmentation](https://dev.meta.ai/docs/sam/segmenting)

## Storage

Software artwork is bundled locally. Some services use their vendor mark. Sources include [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons), [Icons8](https://icons8.com), installed application icons and publisher website icons. The per-icon source list is in **ui/art/software-icon-sources.txt**.

Project data and imported previews are stored in **library/brain.sqlite3** beside the app. Close the server before copying that folder for backup. Scan on demand or enable **Auto-scan** to refresh every 12 seconds while that software view is visible. Scans include subfolders and leave source files in place. Registered software identifies a workflow. Open file uses the Windows file association. For other file types choose Show in folder.

To run without opening a browser, use `python app.py --no-browser` and visit **http://127.0.0.1:48731/**. For a separate library use `python app.py --data "D:\My Brain Library" --port 48732`.

## Tests

Run `python -m unittest -q` for the backend and `node --test test_compare.cjs` for the comparison workflow. The browser test uses Node 22+, Python, and headless Edge with a temporary library and profile. Set `EDGE_PATH` if Edge is installed in a custom location.
