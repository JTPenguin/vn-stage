/**
 * Where everyone stands across the frame: pure arithmetic, no Foundry calls, so
 * it can be checked outside Foundry. One pass, the same rules every time, driven
 * by how crowded the stage is: the width the clusters need at full size and
 * normal overlap (plus the full buffers), divided by the width available.
 *
 *   Clusters one or more, left to right. They always share the available width
 *            in proportion to what each needs, so spacing comes out the same in
 *            each. The first hugs the left edge, the last the right, the ones
 *            between are centred in their share; a lone cluster is centred.
 *   Buffers  the outer pads and the gaps between clusters are full size up to
 *            crowding `crowdStart`, shrinking smoothly to `minBuffer` of that by `crowdEnd`.
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
 * @param {number[][]} widths  each cluster's full-size widths, left to right (no cluster empty)
 * @param {number} frameWidth
 * @param {object} L  the LAYOUT constants
 * @returns {{zoom, crowding, buffers, regions: {from, to, anchor}[]}}  one region per cluster
 */
export function arrange(widths, frameWidth, L) {
  const end = frameWidth;
  const shrink = (crowding) => 1 - clamp((crowding - L.crowdStart) / (L.crowdEnd - L.crowdStart), 0, 1) * (1 - L.minBuffer);

  const needs = widths.map((w) => clusterWidth(w, L.step));
  const need = needs.reduce((a, b) => a + b, 0);
  const gaps = Math.max(0, widths.length - 1);
  const fullBuffers = (2 * L.pad + gaps * L.clusterGap) * frameWidth;
  const crowding = need > 0 ? (need + fullBuffers) / end : 0;
  const buffers = shrink(crowding);
  const pad = L.pad * frameWidth * buffers;
  const gap = L.clusterGap * frameWidth * buffers;
  const available = end - 2 * pad - gaps * gap;
  const zoom = need > 0 ? clamp(available / need, L.minZoom, 1) : 1;

  // Each cluster's share of the width, left to right, with a gap between neighbours.
  const regions = [];
  if (needs.length === 1) regions.push({ from: pad, to: end - pad, anchor: "centre" });
  else {
    let from = pad;
    needs.forEach((n, i) => {
      const share = need > 0 ? (available * n) / need : 0;
      const last = i === needs.length - 1;
      regions.push({ from, to: last ? end - pad : from + share, anchor: i === 0 ? "start" : last ? "end" : "centre" });
      from += share + gap;
    });
  }

  return { zoom, crowding, buffers, regions };
}

/**
 * Centres (frame x) for one cluster, left to right, from its (already zoomed)
 * widths and region. The cluster squeezes only if it still doesn't fit, and
 * spreads out (to `roomyFactor`) when it has room to spare. It hugs the start
 * or the end of its region, or is centred in it, as the region's anchor says.
 */
export function clusterCentres(widths, region, factor, roomyFactor = factor) {
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
  if (region.anchor === "end") return offsets.map((o) => region.to - (extent - o));
  const inset = region.anchor === "centre" ? Math.max(0, (room - extent) / 2) : 0;
  return offsets.map((o) => region.from + inset + o);
}
