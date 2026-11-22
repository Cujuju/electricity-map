/**
 * Publishes `--svg-unit` (chart units per screen pixel) on every SVG with a viewBox, so SVG text can be sized
 * in screen pixels: `font-size: calc(10px * var(--svg-unit, 1))` renders at exactly 10px at any chart width.
 */
const sized = new ResizeObserver((entries) => {
  for (const entry of entries) {
    publish(entry.target as SVGSVGElement);
    scheduleCull(entry.target as SVGSVGElement);
  }
});

/** Selector for labels in `svg[data-label-cull]` that hide when they would overlap an earlier-kept label. */
const CULLED_LABEL = 'text[data-label]';
// Minimum clear space between labels, in screen pixels.
const LABEL_GAP_PX = 2;
const pending = new Set<SVGSVGElement>();

function scheduleCull(svg: SVGSVGElement) {
  if (!svg.hasAttribute('data-label-cull') || pending.has(svg)) return;
  pending.add(svg);
  requestAnimationFrame(() => {
    pending.delete(svg);
    cull(svg);
  });
}

/**
 * Keeps the selected label, then labels in DOM order, hiding any whose screen box overlaps a kept one.
 * Unmarked SVG text (legends, keys) and `[data-label-obstacle]` HTML over the chart are never hidden and block labels.
 */
function cull(svg: SVGSVGElement) {
  const labels = [...svg.querySelectorAll<SVGTextElement>(CULLED_LABEL)];
  labels.forEach((label) => label.removeAttribute('data-culled'));
  const selected = (label: SVGTextElement) => label.closest('.is-selected, [aria-pressed="true"]') !== null;
  const area = svg.getBoundingClientRect();
  const fixed = [
    ...svg.querySelectorAll<SVGTextElement>(`text:not([data-label])`),
    ...document.querySelectorAll<HTMLElement>('[data-label-obstacle]'),
  ]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width && r.left < area.right && r.right > area.left && r.top < area.bottom && r.bottom > area.top);
  const kept: DOMRect[] = [...fixed];
  for (const label of [...labels.filter(selected), ...labels.filter((label) => !selected(label))]) {
    const box = label.getBoundingClientRect();
    if (!box.width) continue;
    const g = LABEL_GAP_PX;
    const hit = kept.some(
      (k) => box.left < k.right + g && box.right + g > k.left && box.top < k.bottom + g && box.bottom + g > k.top,
    );
    if (hit) label.setAttribute('data-culled', '');
    else kept.push(box);
  }
}

function publish(svg: SVGSVGElement) {
  const box = svg.viewBox.baseVal;
  const { width, height } = svg.getBoundingClientRect();
  if (!box?.width || !box.height || !width || !height) return;
  const sx = width / box.width;
  const sy = height / box.height;
  const fit = svg.preserveAspectRatio.baseVal;
  const scale =
    fit.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE
      ? sx
      : fit.meetOrSlice === SVGPreserveAspectRatio.SVG_MEETORSLICE_SLICE
        ? Math.max(sx, sy)
        : Math.min(sx, sy);
  svg.style.setProperty('--svg-unit', String(1 / scale));
}

function each(node: Node, apply: (svg: SVGSVGElement) => void) {
  if (node instanceof SVGSVGElement && node.hasAttribute('viewBox')) apply(node);
  if (node instanceof Element) node.querySelectorAll<SVGSVGElement>('svg[viewBox]').forEach(apply);
}

export function watchSvgUnits(root: HTMLElement) {
  each(root, (svg) => sized.observe(svg));
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof SVGSVGElement) publish(record.target);
      record.addedNodes.forEach((node) => each(node, (svg) => sized.observe(svg)));
      record.removedNodes.forEach((node) => each(node, (svg) => sized.unobserve(svg)));
      // Selection, data or label changes inside a culled chart re-run the overlap check.
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const owner = target?.closest('svg[data-label-cull]');
      if (owner) scheduleCull(owner as SVGSVGElement);
    }
  }).observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['viewBox', 'class', 'aria-pressed', 'transform', 'x', 'y'],
  });
}
