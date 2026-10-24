# VN Stage art format

VN Stage shows character art on a stage scene. It finds that art in one folder, by file name. You can make the art any way you like. This page says where to put it.

## The short version

**A character is a folder with a `portrait` image in it.** That is all VN Stage needs. Point the module's **Art folder** setting at the folder that holds your character folders.

```
<Art folder>/
├── Mira Voss/                   one folder per character; the folder name is its key
│   ├── portrait.webp            required: the neutral portrait
│   ├── avatar.webp              optional: the small picture for lists
│   ├── expressions/             optional: one image per expression
│   │   ├── happy.webp
│   │   └── deep-sorrow.png
│   ├── vn-stage.json            optional: extras (see below)
│   └── forms/                   optional: other forms of this character
│       └── corrupted/           a form: the same layout again
│           ├── portrait.webp
│           ├── expressions/…
│           └── vn-stage.json
└── _drafts/                     folders starting with _ are ignored
```

- **Images** can be `.webp`, `.png`, `.jpg`, `.jpeg` or `.avif`. If one name exists in several types, the first of that list wins.
- **All expressions share the portrait's canvas size.** Then swapping an expression never moves the character.
- **Expression names** come from the file name. `happy.webp` is "Happy". `deep-sorrow.png` is "Deep sorrow". The portrait is always "Neutral", so `expressions/neutral.*` is ignored.
- **Other files are ignored.** Tokens, sources and anything else can sit in the same folders.
- **A form** is any `forms/<name>/` folder with a portrait. A form folder without one is not offered. A form can't have forms of its own.
- **Names match without regard to case** for `portrait`, `avatar` and `neutral`. Expression names are used as written.

## `vn-stage.json`

The file adds what file names can't say. Every field except `format` is optional.

```json
{
  "format": 1,
  "label": "Mira Voss",
  "avatar": "avatar.webp",
  "expressions": { "happy": "Happy", "angry": "Angry", "fear": "Afraid" },
  "size": "medium",
  "scale": 0.57,
  "yOffset": 0.055,
  "groups": ["The Crew"]
}
```

| Field | Meaning | Default |
|---|---|---|
| `format` | **Required.** The format version, `1`. VN Stage warns about a version it doesn't know and reads what it can. | — |
| `label` | The name shown in the module. For a form, the form's name: VN Stage shows "Mira Voss · Corrupted". | The folder name (a form's, capitalised) |
| `portrait` | The neutral portrait, relative to this folder | `portrait.*` |
| `avatar` | The small picture for lists | `avatar.*`, else the portrait |
| `expressions` | `{ name: label }`: the order and labels of the expressions in `expressions/`. Names not listed come after, in file-name order. Names with no image are ignored. | File-name order, labels from file names |
| `size` | Creature size: `tiny`, `small`, `medium`, `large`, `huge` or `gargantuan`. The actor's sheet wins when the game system has one (PF2e). | `medium` |
| `scale` | Default height, as a multiple of the frame height (see below). Must be above 0. | `1` |
| `yOffset` | Default drop from standing on the bottom edge, as a share of the frame height. Positive is lower. | `0` |
| `groups` | Names of the groups that include this character | None |

- **Unknown fields are ignored,** so tools can add their own.
- **A broken file** (not JSON, or not an object) gives one console warning. The character still loads from its folders.
- **A bad value** (a size that isn't in the list, a scale of 0) gives a warning and uses the default.
- **There are no face fields.** VN Stage never stores or measures where a face is.
- **A JSON Schema** for the file is in [vn-stage.schema.json](vn-stage.schema.json), so tools can check what they write.

## How sizing works

VN Stage sizes art by height, not by face.

- **Scale 1 means as tall as the frame,** standing on its bottom edge. The image's pixel size doesn't matter, only its shape.
- **The file sets the starting values.** A character's scale and drop are the file's `scale` and `yOffset` until someone changes them in the Adjust window.
- **Adjust shows the actual values.** It opens at the file's values. A new value replaces the file's in this world only. Reset goes back to the file's values.
- **Final height** = the scale × the creature size. Creature size multiplies by Tiny 0.7, Small 0.82, Medium 1, Large and bigger 1.08.
- **Final drop** = the yOffset, as a share of the frame height.
- **Art with no VN portrait** (the actor's own image) starts at a scale of 0.5.
- **The face guide** in the Adjust window is two lines where faces should start and end, for the character's size. It's a drawing to line art up against, not a measurement.
- **Crowded stages** zoom everyone out around the guide's centre line. Art lined up on the guide stays on it while it shrinks.

To find good values, open Adjust on a stage and line the face up with the guide. To make them the default for every world, copy them into the file and reset Adjust:

- **File `scale`** = Adjust's Scale.
- **File `yOffset`** = Adjust's Height ÷ 100. Adjust shows Height as a percentage of the frame height, and the file holds a share. A Height of 5.5% is 0.055.

## Worked example

```
Art/
├── Mira Voss/
│   ├── portrait.webp
│   ├── expressions/
│   │   ├── happy.webp
│   │   └── angry.webp
│   └── vn-stage.json
└── Old Tom/
    └── portrait.png
```

`Old Tom` works as it is: a neutral portrait at full frame height, size Medium. `Mira Voss` has two expressions, shown as buttons labelled "Happy" and "Angry". Her file:

```json
{ "format": 1, "scale": 0.6, "yOffset": 0.04, "groups": ["The Crew"] }
```

She stands at 60% of the frame's height, a little lower than the bottom edge, and belongs to the group "The Crew".

## How VN Stage reads it

The GM's screen lists the folders and reads each `vn-stage.json`. It saves the result as a world setting, so players get the same art without browsing files. New art shows up after the Stage window's refresh button, or when the Art folder setting changes.
