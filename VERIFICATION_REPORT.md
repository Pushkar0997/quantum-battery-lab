# Verification report — Quantum Battery Lab, interactive JS edition

## Summary

The browser-side numerical model, new guided experiment missions, chart scrubbing logic, source syntax, Python helper syntax, and Python statevector fallback were tested locally. The actual Qollab JS project loader, JS-to-Python interop, and an injected Qollab quantum backend cannot be exercised by the local environment; test those in Qollab before recording the final demo. The earlier Qollab screenshot supplied during this conversation did show the status “Qiskit batch completed: 25 time-point circuits submitted in one job” for the previous JS version, but this exact revised archive must still be re-run after upload.

## JavaScript syntax and model checks

Environment: Node.js 22.16.0. `main.js` passed a syntax check as an ES module. A local DOM-stub harness ran the actual client-side model and its six in-page checks.

All six checks passed:

1. State norm stays within 1e-7 across trajectories.
2. Time-independent total energy is conserved within the tested tolerance.
3. All four battery-energy and ergotropy curves start at zero.
4. Ergotropy remains between zero and stored battery energy.
5. The two-cell closed-form result matches numerical evolution.
6. At zero coupling, star, chain and all-to-all energy curves match the parallel baseline within numerical tolerance.

At N=3, omega=1.0, drive=0.7, coupling=0.8, tMax=3.0 and 24 time intervals, the JavaScript curves were independently cross-checked against the Python spectral eigensolver. Maximum absolute energy differences were 5.0e-9 (star), 5.5e-10 (chain), 6.1e-10 (all-to-all), and 5.0e-10 (parallel). These are local numerical validation results, not a Qollab or hardware run.

The N=7, 36-interval, tMax=4.0 case completed in about 0.19 seconds in Node and passed the six client-side checks. Timing is local and illustrative, not a Qollab performance benchmark.

## New interactions tested locally

- The **Interactions off** mission set the coupling value to zero, reran the model, and generated an actual maximum energy-curve gap versus parallel.
- The **Scale to seven cells** mission set N=7 and passed the client-side checks.
- The **Power vs. stored energy** mission calculates the peak-power topology and final-energy topology from the live curves rather than using hardcoded winners.
- The **Stronger coupling** mission updates the chain parameters and calculates the maximum chain-vs-parallel energy gap.
- Play/Pause timeline and click-to-scrub handlers were added and syntax-checked; their timing and keyboard behavior still need a browser/Qollab interaction test.

## Python bridge checks

Environment: Python 3.13.5, NumPy 2.3.5, SciPy 1.17.0. `python -m py_compile` passed for `battery/*.py` and `quantum/demo.py`.

Calling `quantum.demo.run_selected_topology(None, settings_json)` returned valid JSON with the expected number of time points and the source label `NumPy Trotter-statevector fallback (not QPU output)`. All eight Python model/Trotter checks passed: exact-state norm, energy conservation, Trotter-state normalization, zero-time limits, zero-coupling limit, two-cell closed form, ergotropy bounds, and the tested second-order Trotter convergence check.

Qiskit is not installed in the local environment, so this test did **not** exercise circuit construction, transpilation, or a real backend job.

## Image-loading change

The earlier README used paths such as `assets/example_dynamics.png`, which appeared broken in the project-page screenshot. The revised README embeds its four figures directly as data-URI Markdown images and also includes root-level PNG copies plus the originals in `assets/`. This avoids reliance on nested relative project paths. The Qollab Markdown renderer’s handling of embedded `data:image/png` URLs has not been verified here. After uploading, check that the README banner and diagrams actually render. If Qollab strips data-URI images, an externally hosted public image URL or platform-supported image upload will be needed; do not claim this path is confirmed until visually checked.

## Not verified on Qollab

- JS project initialization from `index.html`, `main.js`, and `main.css` in Qollab's iframe.
- The documented `import * as batteryBridge from 'quantum.demo'` import and `.callPromising(backend, settings_json)` interop.
- `QuantumCircuit` gate construction, transpilation of a circuit list, `backend.run(circuits, shots=...)`, and result extraction under Qiskit 2.x.
- Live Play/Pause timing and click-to-scrub behavior in the Qollab iframe.
- README data-URI image rendering.
- Any IonQ hardware run or calibrated hardware-noise result.

## Six-step Qollab test plan

1. Upload this complete ZIP as a JS/Qiskit wrapper; confirm root files stay at the root.
2. Press Run; inspect the hero, four mission cards, topology map, three charts and six PASS checks.
3. Click **Interactions off**, confirm coupling becomes zero, and inspect the calculated gap report.
4. Press **Play trajectory**, pause it, click an energy chart at a later time, and confirm the metric readouts follow the time selection.
5. Change to seven cells, then select the built-in simulator and run the optional batched circuit validation; confirm the source says `selected Qollab backend` if it genuinely used the selected backend.
6. Check the README images and publish only after they display; then record the two-minute demo and add its public link to the submission form.
