// The spring's equation with m, c and k draggable, shared by the spine and the right pane:
// both show the same spring (the store's m, c, k), so both carry the same handles on it.

export const EQUATION = `<math display="block"><mrow>
  <mn data-scrub="m" data-digits="2">1.00</mn><msup><mi>x</mi><mo>″</mo></msup><mo>+</mo>
  <mn data-scrub="c" data-digits="2">0.10</mn><msup><mi>x</mi><mo>′</mo></msup><mo>+</mo>
  <mn data-scrub="k" data-digits="1">100.0</mn><mi>x</mi><mo>=</mo><mn>0</mn>
</mrow></math>`;

/** Scrub ranges for m, c, k: narrower than the tuple's LIMITS, so a drag stays on the plane. */
export const SCRUB_LIMITS = { m: [0.1, 20], c: [0, 30], k: [0, 400] };
