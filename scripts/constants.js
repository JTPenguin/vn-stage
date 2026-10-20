export const MODULE = "vn-stage";

/** Every stage scene is this fixed 16:9 frame, so layouts never depend on the background's size. */
export const FRAME = Object.freeze({ width: 2560, height: 1440 });

/** Tile flag `part` values. */
export const PART = Object.freeze({ BACKGROUND: "background" });
