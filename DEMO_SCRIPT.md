# Two-minute demo script — Quantum Battery Lab

**0:00–0:15 | Hero and interaction map**
“Welcome to Quantum Battery Lab, an interactive way to explore how the architecture of a small quantum battery changes its charging dynamics. Unlike a static notebook, we can switch topologies, change parameters and inspect the energy, power and ergotropy curves directly.”

**0:15–0:35 | Choose the topologies**
“Here we compare four models: a star with an auxiliary charger, a nearest-neighbour chain, all-to-all exchange, and an independent parallel baseline. The star begins with an excited hub, so that is an extra energy resource and must be counted when interpreting results.”

**0:35–0:55 | Change controls**
“I’ll change the cell count and coupling strength, then run the classical comparison. The local drive coefficients share a fixed squared-strength budget, and the edge coupling coefficients are normalized across the graph. This makes the assumptions explicit, although the topologies do not use identical resources in every sense.”

**0:55–1:20 | Scrub charts and metrics**
“These plots show stored energy, average power and ergotropy over time. The scrubber updates the selected-time metrics, so we can see how the ranking can change with the time horizon. Ergotropy is useful because stored energy and extractable work are not always the same for a mixed battery state.”

**1:20–1:42 | Optional Qiskit validation**
“I’ll run the optional Trotter circuit for the selected topology. The app batches the time-point circuits into one backend job, then overlays finite-shot energy estimates and their uncertainty against the classical reference. The gap contains both Trotter and measurement effects.”

**1:42–2:00 | Caveats and close**
“This is a small toy-model teaching tool, not a claim of quantum advantage or a reproduction of a published experiment. Exact classical methods remain the reference at these sizes. The goal is to understand the dynamics and learn why fairness conventions matter when comparing quantum batteries.”
