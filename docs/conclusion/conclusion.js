// conclusion.js: the closing page, row panelCount + 1. It has no logic of its own — the
// background collage is title.js's `mount`, re-run against this section's own `.gifs` layer
// (title.js resolves its gif filenames relative to its own module URL, so importing it from
// here still finds docs/title/gifs/). Keeping one collage engine, not two, is the point.

export { mount } from '../title/title.js';
