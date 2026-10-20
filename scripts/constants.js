export const MODULE = "vn-stage";

/** Every stage scene is this fixed 16:9 frame, so layouts never depend on the background's size. */
export const FRAME = Object.freeze({ width: 2560, height: 1440 });

/** Every face (forehead to chin) is drawn this tall, as a share of the frame height. */
export const FACE = 0.08;

/** Where faces should start, as a share of the frame height: the top line of the face guide. */
export const GUIDE_TOP = 0.54;

/**
 * Faces from the top of the face down to the (unseen) ground, for a Medium
 * character. Bigger and smaller creatures keep the same ground, so their face
 * guide sits higher or lower as well as growing or shrinking.
 */
export const HEADS = 7;

/** Creature size → scale. PF2e codes and the manifests' words both appear. */
export const SIZE = Object.freeze({
  tiny: 0.7,
  sm: 0.82, small: 0.82,
  med: 1, medium: 1,
  lg: 1.08, large: 1.08, huge: 1.08, grg: 1.08, gargantuan: 1.08,
});

/** The sizes offered in the Adjust window. */
export const SIZE_CHOICES = Object.freeze({ tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" });

/**
 * Where a face of `scale` should start and end, as shares of the frame height.
 * A crowded stage zooms out around each face's centre (it stays where it stood
 * at full size and only shrinks), so a zoomed face keeps its centre.
 */
export function faceGuide(scale = 1, zoom = 1) {
  const ground = GUIDE_TOP + HEADS * FACE;
  const top = ground - HEADS * FACE * scale;
  const centre = top + (FACE * scale) / 2;
  const half = (FACE * scale * zoom) / 2;
  return { top: centre - half, bottom: centre + half };
}

/**
 * Clustering. Portraits are shared tiles, so the layout is the same on every
 * screen: it keeps the right side clear for Foundry's sidebar (300 px plus its
 * tabs, about 17% of the frame on a 1920 px screen).
 */
export const LAYOUT = Object.freeze({
  sidebar: 0.17,   // share of the frame width kept clear on the right
  pad: 0.02,       // share of the frame width kept clear at each outer edge
  centreGap: 0.04, // between the two sides' clusters
  step: 0.55,      // a neighbour stands this share of the pair's average width further in
  fullStep: 0.9,   // The Party at full width: wider spacing, for the Landing's lower-thirds
  // Crowding = width needed at full size (with full buffers) / width available (see arrange.js).
  crowdStart: 1.0, // buffers start shrinking here...
  crowdEnd: 1.2,   // ...and reach minBuffer here
  minBuffer: 0.25, // smallest buffers, as a share of their full size
  minZoom: 0.75,   // everyone shrinks together to no less than this; past it, clusters overlap more
  shadeFade: 0.1,  // zoomed-out portraits rise; a dark band fades in over this share of the height above their cut-off edges
});

/** Tile flag `part` values. */
export const PART = Object.freeze({ BACKGROUND: "background", PORTRAIT: "portrait", SHADE: "shade" });
