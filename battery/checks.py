"""Deterministic physics checks required by the Quantum Battery Lab brief."""

import numpy as np
from battery.model import (
    TOPOLOGIES,
    build_total_hamiltonian,
    evolve_exact_curve,
    initial_state,
    two_cell_analytic_energy,
)
from battery.circuits import trotter_statevector_curve


def _max_energy_error(n, topology, omega, drive, coupling, t_max, steps):
    times = np.linspace(0.0, t_max, steps + 1)
    exact = evolve_exact_curve(n, topology, omega, drive, coupling, times)
    _, approximate, _ = trotter_statevector_curve(n, topology, omega, drive, coupling, t_max, steps)
    return float(np.max(np.abs(approximate - exact["energy"])))


def run_self_checks():
    results = []

    # 1. Exact-state norms and total energy conservation for every topology.
    times = np.linspace(0.0, 1.4, 8)
    worst_norm_error = 0.0
    worst_energy_drift = 0.0
    for topology in TOPOLOGIES:
        curve = evolve_exact_curve(3, topology, 1.0, 0.55, 0.6, times)
        worst_norm_error = max(worst_norm_error, float(np.max(np.abs(curve["norms"] - 1.0))))
        worst_energy_drift = max(worst_energy_drift, float(np.max(np.abs(curve["total_energy"] - curve["total_energy_initial"]))))
    results.append(("exact state norm stays within 1e-9", worst_norm_error < 1e-9,
                    "worst deviation={:.3e}".format(worst_norm_error)))
    results.append(("time-independent total energy conserved within 1e-8", worst_energy_drift < 1e-8,
                    "worst drift={:.3e}".format(worst_energy_drift)))

    # Trotter product formulas are unitary too; check the matched statevector path.
    worst_trotter_norm_error = 0.0
    for topology in TOPOLOGIES:
        _, _, trotter_states = trotter_statevector_curve(3, topology, 1.0, 0.55, 0.6, 1.4, 7)
        for state in trotter_states:
            worst_trotter_norm_error = max(
                worst_trotter_norm_error,
                abs(float(np.vdot(state, state).real) - 1.0),
            )
    results.append(("Trotter states remain normalized within 1e-9", worst_trotter_norm_error < 1e-9,
                    "worst deviation={:.3e}".format(worst_trotter_norm_error)))

    # 2. All topologies start with zero battery energy and couple to the same
    # parallel curve when interaction coupling is zero (star hub is decoupled).
    zero_time = [0.0]
    zero_curves = {
        topology: evolve_exact_curve(3, topology, 1.0, 0.55, 0.0, zero_time)
        for topology in TOPOLOGIES
    }
    start_ok = all(
        abs(float(curve["energy"][0])) < 1e-12
        and abs(float(curve["ergotropy"][0])) < 1e-12
        for curve in zero_curves.values()
    )
    comparison_times = np.linspace(0.0, 1.3, 7)
    parallel = evolve_exact_curve(3, "parallel", 1.0, 0.55, 0.0, comparison_times)["energy"]
    coupling_zero_ok = all(
        np.allclose(
            evolve_exact_curve(3, topology, 1.0, 0.55, 0.0, comparison_times)["energy"],
            parallel, atol=1e-10, rtol=0.0,
        )
        for topology in ("star", "chain", "all-to-all")
    )
    results.append(("at t=0 all battery energies and ergotropies are zero", start_ok,
                    "stored energy and extractable work both vanish"))
    results.append(("zero coupling makes topology curves match parallel", coupling_zero_ok,
                    "max difference must be < 1e-10"))

    # 3. Hand-checkable N=2 independent-drive result at coupling=0.
    test_time, test_omega, test_drive = 0.73, 1.0, 0.45
    exact_two = evolve_exact_curve(2, "parallel", test_omega, test_drive, 0.0, [test_time])["energy"][0]
    analytic_two = two_cell_analytic_energy(test_time, test_omega, test_drive)
    analytic_error = abs(exact_two - analytic_two)
    results.append(("two-cell closed-form result matches exact evolution", analytic_error < 1e-10,
                    "absolute error={:.3e}".format(analytic_error)))

    # 4. Ergotropy is bounded by stored energy for this zero-ground-energy battery.
    ergotropy_bounds_ok = True
    for topology in TOPOLOGIES:
        curve = evolve_exact_curve(3, topology, 1.0, 0.55, 0.6, times)
        if np.any(curve["ergotropy"] < -1e-9) or np.any(curve["ergotropy"] > curve["energy"] + 1e-8):
            ergotropy_bounds_ok = False
    results.append(("ergotropy stays between zero and stored energy", ergotropy_bounds_ok,
                    "checked every time point for all four topologies"))

    # 5. Second-order Trotter convergence: compare errors at common times while
    # doubling slices. The test uses a fixed nontrivial chain model.
    coarse_error = _max_energy_error(2, "chain", 1.0, 0.45, 0.7, 1.8, 4)
    fine_error = _max_energy_error(2, "chain", 1.0, 0.45, 0.7, 1.8, 8)
    convergence_ok = fine_error < coarse_error
    results.append(("Trotter energy error shrinks when slices double", convergence_ok,
                    "4 slices={:.3e}; 8 slices={:.3e}".format(coarse_error, fine_error)))

    all_passed = True
    print("Quantum Battery Lab self-checks:")
    for name, passed, detail in results:
        print("[{}] {} ({})".format("PASS" if passed else "FAIL", name, detail))
        all_passed = all_passed and bool(passed)
    return all_passed
