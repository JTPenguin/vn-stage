# VN Stage

VN Stage turns a Foundry scene into a visual-novel stage. Characters stand in front of a full-screen background as large portraits. Players change their own characters' expressions, and the GM swaps backgrounds and casts with a click. It works with any game system, and it adds a few extras for Pathfinder 2e.

Released under the MIT licence: <https://github.com/JTPenguin/vn-stage>.

## What you get

- **A stage on any scene.** Your players' view fits the stage and stays put. They can't pan or zoom away by accident.
- **Portraits in groups.** Characters stand in one or more groups (clusters) spread across the stage. Drag a portrait to move it, or to start a new group.
- **Expressions and forms.** Each character can have any number of expressions, and other forms (a disguise, a werewolf shape). Players switch their own characters; the GM can switch anyone.
- **Backgrounds** that crossfade when you change them. Still images and videos both work.
- **Presets.** Save a background and cast as a preset, then load the whole scene again with one click.
- **Tags** that gather the characters, backgrounds and presets for one adventure or place, so the lists stay short.
- **Smooth movement.** Portraits fade in and out, slide to new places, and cast a soft shadow.

## Requirements

- Foundry VTT 14.
- Any game system. With Pathfinder 2e, the party actor and creature sizes from character sheets are used too.

## Install

1. In Foundry's **Add-on Modules** tab, choose **Install Module** and paste this manifest URL:

   ```
   https://github.com/JTPenguin/vn-stage/releases/latest/download/module.json
   ```

   Foundry then offers updates by itself. Without internet access, unzip a release's `vn-stage.zip` into `<Foundry data folder>/Data/modules/` instead.
2. Restart Foundry, then turn on **VN Stage** under **Manage Modules** in your world.
3. In **Configure Settings → VN Stage**, set the **Art folder** (see the next section).

**Coming from 0.2.0:** install over it with the manifest URL. The first time the GM loads the world, VN Stage upgrades its stored stages and presets once. Older versions can't read them afterwards.

## Set up your art

VN Stage finds character art by folder name. **A character is a folder with a `portrait` image in it.** Put all the character folders in one folder and choose that folder as the **Art folder**.

```
VN Art/
├── Mira Voss/
│   ├── portrait.webp          the neutral portrait (required)
│   └── expressions/           one image per expression (optional)
│       ├── happy.webp
│       └── angry.webp
└── Old Tom/
    └── portrait.png
```

- **Make every expression the same canvas size as the portrait,** so the character doesn't jump when the expression changes.
- **Forms** go in `forms/<name>/` inside the character's folder, laid out the same way.
- **An optional `vn-stage.json`** sets a display name, a default size and height, and tags.
- **No art yet?** Any actor works. VN Stage uses the actor's own image until it has a portrait.

The full format, including how sizing works, is in [docs/art-format.md](docs/art-format.md).

**Matching art to actors:** an actor uses the art folder with its name, or the folder its portrait or token image comes from. To point an actor at a different folder, use **VN art…** in its character menu (see below).

**Don't rename a character's art folder** once you've used it. Flip, size, height, tags and form locks are saved under the folder's name, so a renamed folder loses them. Renaming actors is safe.

## Run a scene

### Open the Stage window

Click the **VN Stage** button (theatre masks) in the token controls on the left. You can also set a key for it in **Configure Controls**.

On a scene that isn't a stage yet, the window offers **Make stage**. That resizes the scene to the stage's frame, turns off the grid and vision, and shows the first background.

The window has three tabs: **Cast**, **Background** and **Presets**. The tag menu beside the tabs filters all three (see [Tags](#tags)).

### Cast

- **Put someone on stage:** drag their tile onto the stage, where they should stand. You can also drag an actor straight from the Actors sidebar.
- **Move someone:** drag their portrait on the stage. A drop between two groups, or at either edge, starts a new group there.
- **Take someone off:** drag their portrait up into the red band at the top of the stage, or click **×** on their tile.
- **The Party** tile (PF2e) puts every party member on stage at once, where you drop it.
- **Search** finds characters by name or tag. Under a tag, it also finds characters outside the tag.
- **Buttons:** reset everyone's expression to neutral, re-read the art folder after adding art, and clear the stage.

### The character menu

Click a portrait on the stage, or right-click a Cast tile, to open the character's menu. It shows their forms and expressions. Click one to switch.

The GM also gets these buttons:

| Button | What it does |
|---|---|
| **Flip** | Mirrors the portrait, so the character faces the other way |
| **Adjust size and height** | Opens the Adjust window (below) |
| **VN art…** | Chooses which art folder this actor uses |
| **Tags…** | Adds or removes the character's tags |
| **Remove from the stage** | Takes the character off |

**Lock a form:** right-click a form in the menu. Players can't see or switch to a locked form; the GM still can. The lock stays with the actor on every stage.

**Adjust window:** sets the character's size, scale and height on the stage. Line the face up with the blue face guide. **Flying** is for art that floats: VN Stage draws a dark band along the bottom of the stage to hide portraits' cut-off lower edges, and leaves it out for a flying character. **Reset** goes back to the art's own values.

### Background

- **Click a thumbnail** to show it. The old background crossfades into the new one.
- **Browse…** shows any image without adding it to a tag.
- **Under a tag,** the tab lists the tag's backgrounds. **Add a background** and **Add folder…** add more, and right-click a background to change its tags.

### Presets

- **Save as preset** saves the background and the cast on stage. Under a tag, the preset gets that tag.
- **Click a preset** to load it. Characters already on stage stay where they are and the rest fade in. A dot by the name means the stage has changed since you loaded it.
- **Party members fill in by who is in the party now,** so a preset still works after the party changes.
- **Right-click a preset** to update it from the stage, rename it, change its tags or delete it.

### Tags

A tag gathers the characters, backgrounds and presets you need for one adventure, chapter or place. Pick a tag from the menu beside the tabs, and all three tabs show only what has it.

- **Recent** lists the characters you used last. **Untagged** lists what has no tag yet.
- **Tags…** (in any right-click menu) opens a small window. Type a tag and press Enter to add it, or click **×** to take it off. A new name makes a new tag.
- **Manage tags** (the gear) renames, merges and deletes tags, and adds folders of backgrounds to them. **New tag from a folder…** starts a tag from a folder of backgrounds.
- **A tag disappears** when nothing carries it any more.

### Your own view

As GM you can pan and zoom as usual. **Lock view** in the Stage window's header fits your view to the stage like the players' views. You can set a key for it in **Configure Controls**.

## What players see

- **The stage fills their screen.** The view refits when they open or close the sidebar.
- **They click a portrait of a character they own** to change its expression or form. Other portraits do nothing for them.

## Settings

All in **Configure Settings → VN Stage**. They apply to the whole world.

| Setting | What it does |
|---|---|
| **Art folder** | The folder that holds your character folders |
| **Safety-net background** | Shown when a scene becomes a stage, and if anything goes wrong with the background on screen |
| **Tag background folders** | A folder each tag finds its backgrounds in by itself. `{tag}` stands for the tag's name, as in `scenes/{tag}/`. Leave it blank for none |
| **Portrait shadows** | A soft shadow behind every portrait |
| **Shadow strength** | How dark the shadows are |

## Two actors with the same name

Two actors called "Guard" are two characters, and both can stand on a stage.

- **Different art:** give each its own art folder, such as `Guard (Docks)` and `Guard (Gate)`. Set `label` to "Guard" in each folder's `vn-stage.json` if the folder name shouldn't show.
- **Shared art:** point both actors at one folder with **VN art…**. Actors that share art also share Flip, size and height.
- **In the Cast tab,** hover over a tile to tell them apart.

## More

- [docs/art-format.md](docs/art-format.md): the full art format.
- [docs/development.md](docs/development.md): the console API, hooks for other modules, stored data and the checks, for people changing or building on the module.
- [CHANGELOG.md](CHANGELOG.md): what changed in each version.
