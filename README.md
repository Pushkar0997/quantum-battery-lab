# Quantum Battery Lab — Interactive Charging Studio

![Quantum Battery Lab banner: charging topologies, stored energy, power and ergotropy](https://raw.githubusercontent.com/Pushkar0997/quantum-battery-lab/main/banner.png)

**Explore how coupling topology changes a small quantum battery's stored energy, average charging power, and extractable work.** Change the model settings, inspect four charging architectures, animate the dynamics over time, and optionally compare a Qiskit Trotter circuit against a classical reference.

> **Theme: Quantum Unlocked.** This is an interactive teaching and benchmarking model. It does not claim quantum advantage, reproduce a particular experiment, or model a practical battery device.
>
> This effort is supported by Qollab & IonQ.

## Start here

The interactive browser app is the main deliverable. Its live network diagram and charts are rendered by the app itself using inline SVG, so they do not depend on README image loading. The explanatory README images below use direct HTTPS URLs to the repository's raw PNG files so they can be loaded by Markdown renderers that do not resolve repository-relative paths.

## Guided missions

The interface includes four one-click investigations, so users can test a question instead of moving sliders blindly:

- **Power vs. stored energy:** check whether the topology with the highest peak average power also has the most stored energy at the final time.
- **Interactions off:** set the coupling budget to zero and compare all battery-energy trajectories with the independent-drive baseline.
- **Stronger coupling:** change the exchange coupling and inspect how the selected chain's dynamics respond.
- **Scale up:** run a seven-cell case and inspect normalization and conservation drift.

Use **Play trajectory** to animate the selected time across all three charts. The charts are clickable and keyboard-navigable, so you can inspect the same time point across all topologies. Mission summaries are calculated from the active model run, not from prewritten results.

## What makes this more than a plot

- Four selectable architectures: star with charger hub, nearest-neighbour chain, all-to-all graph, and independent parallel baseline.
- A network diagram that redraws when the topology or number of battery cells changes.
- Controls for battery size, energy gap, normalized local-drive strength, normalized edge coupling, time horizon, time-grid resolution, and quantum measurement shots.
- Three shared-axis charts showing stored energy, average charging power, and ergotropy over time.
- A time scrubber and Play/Pause control for exploring charging trajectories.
- A live topology summary comparing peak average power, the time of the peak, final stored energy, and final ergotropy.
- Optional Qiskit validation: one second-order Trotter circuit per displayed time point, submitted together in one backend job; measured stored-energy estimates are overlaid on the classical curve with shot uncertainty.
- Graceful fallback: the JavaScript physics explorer remains usable if the optional Python/Qiskit bridge is unavailable, and the interface labels the fallback rather than fabricating backend results.
- Expandable physics notes about energy, ergotropy, model normalization, and interpretation limits.

## The four charging architectures

![Diagram comparing star, chain, all-to-all and parallel charging topologies](https://raw.githubusercontent.com/Pushkar0997/quantum-battery-lab/main/topologies.png)

### 1. Star

One extra hub/charger qubit connects to every battery cell. The hub begins excited, so the initial star setup includes an additional bare energy of omega. This is an explicit extra resource, not a hidden advantage.

### 2. Nearest-neighbour chain

Battery cells exchange excitations only with adjacent neighbours, while the local drive supplies energy.

### 3. All-to-all

Every pair of battery cells is connected by an exchange interaction.

### 4. Parallel baseline

The cells evolve independently under the same normalized local-drive budget, with no exchange edges.

The diagrams use a consistent visual convention: battery cells are blue, the auxiliary charger is violet, and local-drive arrows are orange.

## Physics model

All variables are dimensionless and hbar = 1. Each battery cell is a two-level system with energy gap omega. The bare battery Hamiltonian is

`H_B = omega * sum_i |1><1|_i`

The all-ground state `|00...0>` has zero battery energy. Stored energy is

`E_B(t) = <H_B>`

Average charging power is defined as `E_B(t) / t` for `t > 0` and set to zero at `t = 0` for plotting.

The local charging drive applies a transverse field to each battery cell with coefficient `drive / sqrt(N)`. This fixes the Euclidean norm of the local-drive coefficient vector when the number of cells changes.

For a topology containing M exchange edges, the interaction is normalized as

`H_edge = (coupling / (2 * sqrt(M))) * sum_(a,b in edges) (X_a X_b + Y_a Y_b)`

Each edge therefore has exchange matrix element `coupling / sqrt(M)`, fixing the sum of squared edge amplitudes to `coupling^2` for every nonempty graph. The parallel baseline has no exchange edges.

![Workflow from the initial state through topology, Trotter circuit, measurement and validation](https://raw.githubusercontent.com/Pushkar0997/quantum-battery-lab/main/workflow.png)

### Fairness and interpretation

The local-drive coefficient norm and the edge-coupling coefficient norm are normalized, but that does **not** make every resource identical. The star has an additional initially excited hub, different topologies have different connectivity and locality, and their Hamiltonians are not identical. Topology rankings are descriptive for the stated model, parameter settings, and finite time horizon, not a resource-independent or universal quantum-advantage claim.

At `coupling = 0`, the hub decouples and all four battery-energy curves should coincide with the parallel baseline. The code tests this limit. The idle hub's initial energy remains outside the battery Hamiltonian.

## What is ergotropy?

**Ergotropy** is the maximum work extractable from a quantum state by a cyclic unitary operation. A state can store energy while some of it is unavailable as useful work because of its population structure or mixedness.

For the star, the battery can become entangled with the auxiliary hub. The simulation traces out the hub, constructs the battery's reduced state, and calculates its ergotropy from the reduced-state eigenvalues and the ordered battery energy levels. Ergotropy can therefore be lower than stored energy. In the other three architectures, the simulated battery state is pure in this model, so ergotropy equals stored energy under the zero-ground-energy convention.

The circuit measurement estimates **stored energy** from computational-basis counts. Ergotropy is calculated from the exact simulated state; measurement counts alone do not provide the state information needed to infer ergotropy on hardware. Hardware ergotropy would require additional information, such as tomography.

## How the classical and quantum paths work

1. Construct the static Hamiltonian for each architecture.
2. Evolve the initial state with the JavaScript model. It integrates the Schrödinger equation with a small internal time step and records state norm, conserved total energy, stored battery energy, and ergotropy.
3. For optional quantum validation, construct a symmetric second-order Trotter sequence from basic Qiskit gates: `RX`, `RZ`, `RXX`, and `RYY`.
4. Build one measured circuit per displayed time point for the selected topology and submit the circuit list in one `backend.run(...)` call.
5. Estimate stored battery energy from measured Z-basis counts and compare those estimates with the exact reference curve. The difference contains both finite-shot uncertainty and Trotter approximation error.
6. Check convergence separately by increasing the number of Trotter slices; do not confuse a convergence test with a hardware-noise measurement.

![An example of the exact classical charging dynamics](https://raw.githubusercontent.com/Pushkar0997/quantum-battery-lab/main/example_dynamics.png)

*The image above is a static example from the companion Python prototype, provided for visual context only. It is not a measurement from the current JavaScript UI, a Qollab run, or quantum hardware.*

## Local reference example

The JavaScript model was locally cross-checked against an independent Python spectral eigensolver using `N = 3`, `omega = 1.0`, `drive = 0.7`, `coupling = 0.8`, `t_max = 3.0`, and 24 time intervals. These are **local mathematical validation results**, not Qollab measurement or hardware results.

| Topology | Peak average power | Time of peak | Final stored energy | Final ergotropy |
|---|---:|---:|---:|---:|
| Star | 0.996109 | 1.375 | 1.003650 | 0.806821 |
| Parallel baseline | 0.551557 | 1.875 | 1.039980 | 1.039980 |
| Chain | 0.379763 | 1.250 | 0.426685 | 0.426685 |
| All-to-all | 0.354583 | 1.250 | 0.232918 | 0.232918 |

At these settings, the star has the highest peak average power in the finite window, while the parallel baseline finishes with greater stored energy. The star also starts with an extra excited hub. These observations illustrate why power, final energy, ergotropy, and resource assumptions must be considered separately.

The maximum absolute difference between the JavaScript model and Python spectral reference was approximately `5.0e-9` for star stored energy, `5.5e-10` for chain, `6.1e-10` for all-to-all, and `5.0e-10` for parallel, at the settings above.

## Running on Qollab

1. Create a **JavaScript / Qiskit wrapper** project or use **Upload your own files** with the complete project ZIP.
2. Keep `index.html`, `main.js`, and `main.css` at the project root. Keep `quantum/demo.py` and helper modules in their folders.
3. Press Run. The interactive classical physics model should load without submitting a backend job.
4. Switch topologies, use the guided missions, change the controls, play/scrub the trajectory, and inspect the expandable physics notes.
5. To test the circuit path, choose a Qollab simulator in the run dialog and click **Validate selected topology on Qollab** in the page.
6. Only describe that result as a Qollab simulator run if the status says `selected Qollab backend` and measured counts, shot uncertainty, and comparison results are shown.

The Python bridge uses the Qollab-provided backend rather than creating or hardcoding one. It is designed to batch all time-point circuits in a single backend job. The JavaScript-to-Python import and `.callPromising(...)` interop path still needs to be tested in the live Qollab runtime. If it fails, the interface should preserve the JavaScript explainer and clearly label any fallback output.

## Self-checks

The interactive model runs its checks after each classical calculation:

1. State norm remains within numerical tolerance across displayed trajectories.
2. Total energy stays approximately conserved for each time-independent Hamiltonian.
3. Battery energy and ergotropy start at zero.
4. Ergotropy remains between zero and stored energy.
5. The two-cell analytical formula agrees with numerical evolution.
6. Setting coupling to zero makes all battery-energy curves agree with the independent-drive baseline.

The optional Python/Qiskit bridge also includes checks for state normalization, total-energy conservation, Trotter-state normalization, zero-time and zero-coupling limits, a two-cell closed-form result, ergotropy bounds, and second-order Trotter convergence.

For actual test scope and limitations, see [`VERIFICATION_REPORT.md`](https://github.com/Pushkar0997/quantum-battery-lab/blob/main/VERIFICATION_REPORT.md).

## Research context (inspiration, not reproduction)

The project is informed by research on charging architectures and on the need to state resource constraints explicitly. It does not reproduce the cited experiments or claim their results for this model.

1. Chang-Kang Hu et al., “Quantum Charging Advantage in Superconducting Solid-State Batteries,” *Physical Review Letters* 136, 060401 (2026). The paper reports a superconducting-qubit implementation with 2–12 battery cells. [arXiv:2602.08610](https://arxiv.org/abs/2602.08610)
2. Matthieu Sarkis, Oskar A. Prośniak, Samuel Nigro, and Alexandre Tkatchenko, “Star Topology Optimizes the Charging Power of Quantum Batteries,” arXiv (2026). The reported result concerns a specific fermionic-battery model and early-time power; it is not a theorem established by this app. [arXiv:2603.10853](https://arxiv.org/abs/2603.10853)
3. Sreeram P. G., J. Bharathi Kannan, and M. S. Santhanam, “Quantum charging advantage based on power bounds can be deceptive” (2025). This motivates examining actual transferred energy rather than relying only on upper bounds. [arXiv:2510.19552](https://arxiv.org/abs/2510.19552)
4. Gyhm, Šafránek, and Rosa, “Quantum Charging Advantage Cannot Be Extensive without Global Operations,” *Physical Review Letters* 128, 140501 (2022). [DOI: 10.1103/PhysRevLett.128.140501](https://doi.org/10.1103/PhysRevLett.128.140501)

## AI assistance and reuse disclosure

This project was developed by team QQuEST with AI assistance for implementation and review. The JavaScript interface, SVG-based live diagrams and charts, guided investigations, and JS-to-Python bridge build on the team's earlier Python Quantum Battery Lab model and circuit helpers, which are included in the repository. The Franck–Condon project is not imported into this project. The team is responsible for reviewing, testing, and explaining the submitted code.

The four images are referenced from the public repository through direct `raw.githubusercontent.com` URLs, not embedded as base64 data. They should not require separate uploads for the README to display them.

## Project files

- `index.html`: page structure for the interactive app.
- `main.js`: live controls, inline SVG diagrams, interactive charts, guided missions, and client-side model.
- `main.css`: responsive visual styling.
- `quantum/demo.py`: optional Qiskit Trotter circuit and measurement bridge.
- `battery/`: model, circuit, plotting, and validation helpers from the Python prototype.
- `banner.png`, `topologies.png`, `workflow.png`, `example_dynamics.png`: public-facing explanatory figures.
- `DEMO_SCRIPT.md`: two-minute recording script.
- `SUBMISSION_ANSWERS.md`: paste-ready submission-form answers.
- `FINAL_SUBMISSION_CHECKLIST.md`: publishing and recording checklist.
- `VERIFICATION_REPORT.md`: local test outcomes and unverified platform assumptions.
- `LICENSE`: MIT licence.

## License

MIT. See [`LICENSE`](https://github.com/Pushkar0997/quantum-battery-lab/blob/main/LICENSE).
