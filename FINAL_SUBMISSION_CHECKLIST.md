# Final submission checklist — Quantum Battery Lab JS edition

## Replace the files
- [ ] Upload this complete ZIP as a **JS / Qiskit wrapper** project.
- [ ] Confirm `index.html`, `main.js`, and `main.css` are at the project root; keep `quantum/`, `battery/`, and `assets/` intact.
- [ ] Confirm the README images appear. They are embedded inline in `README.md` and also included as root-level PNGs and in `assets/` to avoid reliance on nested relative image URLs.

## Fast interactive check
- [ ] Press **Run** and confirm the first screen, charts, topology map and self-check panel appear.
- [ ] Click each of the four Guided Experiment mission cards and check that their settings and result explanation change.
- [ ] Press **Play trajectory**, pause it, click a chart to jump to a time, and use the keyboard arrow keys while a chart is focused.
- [ ] Change cell count, drive and coupling; confirm all four classical curves and the topology ranking update.

## Optional quantum check
- [ ] Select the Qollab built-in simulator and click **Validate selected topology on Qollab**.
- [ ] Confirm the UI says `selected Qollab backend`, that the reported circuit count equals the plotted time-point count, and that one batched job completed.
- [ ] If the bridge fails, keep using the classical interactive lab but do not present fallback samples as backend measurements; record the exact console error.

## Submission requirements
- [ ] Publish with the included MIT licence and the required attribution statement.
- [ ] Add the public 2–3 minute demo-video URL to the submission form.
- [ ] Keep all battery-performance claims qualified by the stated toy model and its charger/resource convention.
