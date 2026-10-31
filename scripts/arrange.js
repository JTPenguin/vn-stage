/**
 * Where everyone stands across the frame: pure arithmetic, no Foundry calls, so
 * it can be checked outside Foundry. One pass, the same rules every time, driven
 * by how crowded the stage is: the width the clusters need at full size and
 * normal overlap (plus the full buffers), divided by the width available.
 *
 *   Sides    always share the available width in proportion to what each needs,
 *            so spacing comes out the same on both sides.
 *   Buffers  the outer pads and the centre gap are full size up to crowding
 *            `crowdStart`, shrinking smoothly to `minBuffer` of that by `crowdEnd`.
 *   Zoom     whatever still doesn't fit scales every portrait down alike, to no
 *            less than `minZoom`.
 *   Overlap  only what's left past the zoom floor squeezes the clusters tighter.
 */

/**
 * The highest bottom edge showing in the frame, where the bottom shade starts:
 * the top of the portraits' bottom edges, capped at the frame height (which
 * means no shade). Fallback images and flying characters don't count.
 */
export function shadeCut(placed, frameHeight) {
  return Math.min(frameHeight, ...placed.filter((p) => !p.fallback && !p.flying).map((p) => p.box.y + p.box.height));
}

/** Width of one cluster: the first and last half-widths plus each step between neighbours. */
export function clusterWidth(widths, factor) {
  if (!widths.length) return 0;
  let w = widths[0] / 2 + widths.at(-1) / 2;
  for (let i = 1; i < widths.length; i++) w += (factor * (widths[i - 1] + widths[i])) / 2;
  return w;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {{left: number[], right: number[]}} widths  each side's full-size widths, first-placed first
 * @param {number} frameWidth
 * @param {object} L  the LAYOUT constants
 * @returns {{zoom, crowding, buffers, regions: {left, right}}}  regions: { from, to, anchor } or null
 */
export function arrange(widths, frameWidth, L) {
  const end = frameWidth;
  const shrink = (crowding) => 1 - clamp((crowding - L.crowdStart) / (L.crowdEnd - L.crowdStart), 0, 1) * (1 - L.minBuffer);

  // The main row: left and right.
  const needL = clusterWidth(widths.left, L.step), needR = clusterWidth(widths.right, L.step);
  const both = needL > 0 && needR > 0;
  const need = needL + needR;
  const fullBuffers = (2 * L.pad + (both ? L.centreGap : 0)) * frameWidth;
  const crowding = need > 0 ? (need + fullBuffers) / end : 0;
  const buffers = shrink(crowding);
  const pad = L.pad * frameWidth * buffers;
  const gap = both ? L.centreGap * frameWidth * buffers : 0;
  const available = end - 2 * pad - gap;
  const zoom = need > 0 ? clamp(available / need, L.minZoom, 1) : 1;

  const regions = { left: null, right: null };
  if (both) {
    const shareL = (available * needL) / need;
    regions.left = { from: pad, to: pad + shareL, anchor: "start" };
    regions.right = { from: end - pad - (available - shareL), to: end - pad, anchor: "end" };
  } else if (needL > 0) regions.left = { from: pad, to: end - pad, anchor: "centre" };
  else if (needR > 0) regions.right = { from: pad, to: end - pad, anchor: "centre" };

  return { zoom, crowding, buffers, regions };
}

/**
 * Centres (frame x) for one side, first-placed first, from its (already zoomed)
 * widths and region. The cluster squeezes only if it still doesn't fit, and
 * spreads out (to `roomyFactor`) when it has room to spare. The left
 * side and the full row run left to right; the right side runs right to left.
 */
export function clusterCentres(side, widths, region, factor, roomyFactor = factor) {
  if (!widths.length || !region) return [];
  const room = region.to - region.from;
  const steps = widths.slice(1).map((w, i) => (factor * (widths[i] + w)) / 2);
  const ends = widths[0] / 2 + widths.at(-1) / 2;
  const total = steps.reduce((a, b) => a + b, 0);
  // Squeeze when it doesn't fit; spread out to `roomyFactor` when there's room to spare.
  const fit = total > 0 ? Math.max(0, room - ends) / total : 1;
  const squeeze = Math.min(fit, roomyFactor / factor);
  const offsets = [widths[0] / 2];
  for (const s of steps) offsets.push(offsets.at(-1) + s * squeeze);
  const extent = offsets.at(-1) + widths.at(-1) / 2;
  const inset = region.anchor === "centre" ? Math.max(0, (room - extent) / 2) : 0;
  return side === "right"
    ? offsets.map((o) => region.to - inset - o)
    : offsets.map((o) => region.from + inset + o);
}
