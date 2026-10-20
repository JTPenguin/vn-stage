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

/** Where a face of `scale` should start and end, as shares of the frame height. */
export function faceGuide(scale = 1) {
  const ground = GUIDE_TOP + HEADS * FACE;
  const top = ground - HEADS * FACE * scale;
  return { top, bottom: top + FACE * scale };
}

/** Tile flag `part` values. */
export const PART = Object.freeze({ BACKGROUND: "background", PORTRAIT: "portrait" });
