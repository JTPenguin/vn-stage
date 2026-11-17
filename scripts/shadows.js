import { MODULE, PART, SHADOW } from "./constants.js";
import { shadowLook } from "./rules.js";

/**
 * A soft shadow behind every portrait, drawn by every screen for itself; no
 * document changes. One shared PIXI filter sits on each portrait tile's own
 * mesh, so the shadow follows every move, flip, fade and drag-dim (fades.js
 * writes only to the mesh). Its `apply()` draws three passes: a black,
 * shifted silhouette of the portrait at the chosen strength, a blur over it,
 * and the portrait itself on top. Offset and blur follow the view's zoom, so
 * the shadow keeps its size against the portrait on every screen.
 *
 * This leans on PIXI's filter internals (see the update checklist in docs/development.md).
 * The first error, in a hook or while drawing, turns shadows off for the
 * session and portraits show without them.
 */

// A black copy of the portrait, shifted by uShift screen pixels, at uAlpha of its own alpha.
const SILHOUETTE = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec2 uShift;
uniform float uAlpha;

void main(void) {
  float a = texture2D(uSampler, vTextureCoord - uShift * inputSize.zw).a;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uAlpha);
}`;

let filter = null;   // built on first use: PIXI.Filter isn't there when the module loads
let setting = null;  // { on, strength }, read again when either setting changes
let broken = false;  // set by the first error: shadows stay off until reload

function part(doc) {
  return doc.getFlag(MODULE, "part");
}

function current() {
  setting ??= {
    on: game.settings.get(MODULE, "portraitShadow"),
    strength: game.settings.get(MODULE, "portraitShadowStrength"),
  };
  return setting;
}

/** The first error: warn once, stop drawing shadows, and take the filter off every portrait. */
function fail(err) {
  if (broken) return;
  broken = true;
  console.warn("VN Stage | Portrait shadows turned off after an error", err);
  if (filter) filter.enabled = false;
  // Not from inside a render: let this frame finish first.
  setTimeout(() => {
    for (const t of canvas.tiles?.placeables ?? []) if (filter && t.mesh && !t.mesh.destroyed && t.mesh.filters?.includes(filter)) takeOff(t.mesh);
  });
}

/** A hook handler that turns shadows off instead of throwing. */
function guarded(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      fail(err);
    }
  };
}

function makeFilter() {
  class ShadowFilter extends PIXI.Filter {
    constructor() {
      super(); // draws its input unchanged: the portrait on top
      this.silhouette = new PIXI.Filter(undefined, SILHOUETTE, { uShift: new Float32Array(2), uAlpha: 1 });
      this.blurFilter = new PIXI.BlurFilter();
    }

    apply(fm, input, output, clear) {
      if (broken) return fm.applyFilter(this, input, output, clear);
      let tmp = null;
      try {
        const look = shadowLook({ ...current(), scale: canvas.stage.scale.x }, SHADOW);
        if (!look) return fm.applyFilter(this, input, output, clear);
        // Read by PIXI before apply(), so a new zoom gets its padding from the next frame on.
        this.padding = look.padding;
        this.silhouette.uniforms.uShift[0] = look.shiftX;
        this.silhouette.uniforms.uShift[1] = look.shiftY;
        this.silhouette.uniforms.uAlpha = look.alpha;
        this.blurFilter.blur = look.blur;
        tmp = fm.getFilterTexture(input);
        this.silhouette.apply(fm, input, tmp, PIXI.CLEAR_MODES.CLEAR);
        this.blurFilter.apply(fm, tmp, output, clear);
        fm.applyFilter(this, input, output, PIXI.CLEAR_MODES.BLEND);
      } catch (err) {
        fail(err);
        try { fm.applyFilter(this, input, output, clear); } catch { /* nothing more to draw this frame */ }
      } finally {
        if (tmp) fm.returnFilterTexture(tmp);
      }
    }
  }
  return new ShadowFilter();
}

/** Put the shadow on a portrait's mesh, or take it off, as the settings say. */
function update(tile) {
  const mesh = tile.mesh;
  if (part(tile.document) !== PART.PORTRAIT || !mesh || mesh.destroyed) return;
  const want = !broken && !!shadowLook({ ...current(), scale: 1 }, SHADOW);
  if (want) filter ??= makeFilter();
  const has = !!filter && !!mesh.filters?.includes(filter);
  if (want && !has) mesh.filters = [...(mesh.filters ?? []), filter];
  else if (!want && has) takeOff(mesh);
}

/** Remove our filter from a mesh, leaving any others (another module's) in place. */
function takeOff(mesh) {
  const rest = mesh.filters.filter((f) => f !== filter);
  mesh.filters = rest.length ? rest : null;
}

export function registerShadows() {
  Hooks.on("drawTile", guarded(update));
  Hooks.on("refreshTile", guarded(update));
}

/** A shadow setting changed: every portrait on this screen follows. */
export const refreshShadows = guarded(() => {
  setting = null;
  for (const t of canvas.tiles?.placeables ?? []) update(t);
});
