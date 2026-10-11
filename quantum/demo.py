"""Qollab JS-to-Python bridge for the optional quantum-circuit experiment.

The interactive exact-model explorer lives in plain JavaScript. This module
builds measured Trotter circuits for the selected topology and returns JSON so
the UI can overlay finite-shot measurements on its exact-model curve.
"""

import json
import math


def _get_counts_list(result, number_of_circuits):
    counts_list = []
    for index in range(number_of_circuits):
        try:
            counts = result.get_counts(index)
        except Exception:
            all_counts = result.get_counts()
            if isinstance(all_counts, list):
                counts = all_counts[index]
            elif number_of_circuits == 1 and isinstance(all_counts, dict):
                counts = all_counts
            else:
                raise RuntimeError("Backend result did not expose one counts dictionary per circuit.")
        if not isinstance(counts, dict):
            try:
                counts = dict(counts)
            except Exception as exc:
                raise RuntimeError("Could not convert backend counts for circuit {}.".format(index)) from exc
        counts_list.append(counts)
    return counts_list


def _validate_settings(settings):
    topology = str(settings.get("topology", "star"))
    n_cells = int(settings.get("nCells", 3))
    omega = float(settings.get("omega", 1.0))
    drive = float(settings.get("drive", 0.7))
    coupling = float(settings.get("coupling", 0.8))
    t_max = float(settings.get("tMax", 3.0))
    steps = int(settings.get("steps", 24))
    shots = int(settings.get("shots", 1000))
    if topology not in ("star", "chain", "all-to-all", "parallel"):
        raise ValueError("Unknown topology: {}".format(topology))
    if not 2 <= n_cells <= 7:
        raise ValueError("nCells must be in [2, 7].")
    if not (math.isfinite(omega) and omega > 0):
        raise ValueError("omega must be finite and positive.")
    if not (math.isfinite(drive) and drive >= 0 and math.isfinite(coupling) and coupling >= 0):
        raise ValueError("drive and coupling must be finite and non-negative.")
    if not (math.isfinite(t_max) and t_max > 0):
        raise ValueError("tMax must be finite and positive.")
    if not 12 <= steps <= 24:
        raise ValueError("steps must be in [12, 24].")
    if not 200 <= shots <= 2500:
        raise ValueError("shots must be in [200, 2500].")
    return topology, n_cells, omega, drive, coupling, t_max, steps, shots


def run_selected_topology(backend_object, settings_json):
    """Run a single batched Qiskit job, or fall back to seeded NumPy sampling.

    Exactly one backend.run call is attempted per invocation. Any error falls
    back to the NumPy Trotter statevector and is returned with a clear source tag.
    The return value is a JSON string for robust JS/Pyodide interop.
    """
    try:
        from battery.checks import run_self_checks
        from battery.model import evolve_exact_curve, validate_settings
        from battery.circuits import (
            build_trotter_circuit,
            battery_energy_stats_from_counts,
            sample_statevector_counts,
            trotter_statevector_curve,
        )
        import numpy as np

        if isinstance(settings_json, str):
            settings = json.loads(settings_json)
        else:
            settings = settings_json
        topology, n_cells, omega, drive, coupling, t_max, steps, shots = _validate_settings(settings)
        print("\nOPTIONAL QISKIT CIRCUIT VALIDATION")
        print("Selected topology: {}; {} battery cells; {} time points; {} shots each.".format(
            topology, n_cells, steps + 1, shots
        ))
        print("The classical interactive curves were calculated in JavaScript. Building the circuit batch now.")
        checks_ok = run_self_checks()
        if not checks_ok:
            print("[WARN] A Python bridge self-check failed; circuit result should be treated cautiously.")

        times = np.linspace(0.0, t_max, steps + 1)
        count_sets = None
        source = ""
        backend_error = ""
        if backend_object is not None:
            try:
                # Build and submit one list of circuits: one backend.run call per click.
                circuits = [
                    build_trotter_circuit(n_cells, topology, omega, drive, coupling, index, steps, t_max)
                    for index in range(steps + 1)
                ]
                from qiskit import transpile
                compiled = transpile(circuits, backend=backend_object)
                job = backend_object.run(compiled, shots=shots)
                result = job.result()
                count_sets = _get_counts_list(result, len(circuits))
                source = "selected Qollab backend"
                print("[PASS] Submitted {} time-point circuits in one backend.run call.".format(len(circuits)))
            except Exception as exc:
                backend_error = str(exc)[:240]
                print("[WARN] Quantum backend path failed: {}".format(backend_error))
                print("Falling back to NumPy Trotter-statevector sampling; this is not QPU output.")
        else:
            backend_error = "No Qollab backend was injected into the JavaScript project."
            print("[WARN] {}; using the NumPy Trotter-statevector fallback.".format(backend_error))

        if count_sets is None:
            _, _, states = trotter_statevector_curve(
                n_cells, topology, omega, drive, coupling, t_max, steps
            )
            count_sets = [
                sample_statevector_counts(state, shots, seed=20261012 + index)
                for index, state in enumerate(states)
            ]
            source = "NumPy Trotter-statevector fallback (not QPU output)"

        energies, standard_errors = [], []
        for counts in count_sets:
            mean, stderr = battery_energy_stats_from_counts(counts, n_cells, omega)
            energies.append(float(mean))
            standard_errors.append(float(stderr))

        exact_curve = evolve_exact_curve(
            n_cells, topology, omega, drive, coupling, times
        )
        gaps = [abs(float(sample) - float(exact)) for sample, exact in zip(energies, exact_curve["energy"])]
        max_gap = max(gaps) if gaps else 0.0
        print("Source: {}".format(source))
        print("Max |sampled E_B - exact Python E_B| over time: {:.6f}.".format(max_gap))
        print("This discrepancy includes Trotter approximation and finite-shot effects.")
        if backend_error:
            print("Backend fallback reason: {}".format(backend_error))

        output = {
            "ok": True,
            "topology": topology,
            "times": [float(x) for x in times],
            "energy": energies,
            "stderr": standard_errors,
            "shots": shots,
            "source": source,
            "backend_error": backend_error,
            "max_abs_gap_vs_python_exact": float(max_gap),
            "n_circuits": int(steps + 1),
            "self_checks_passed": bool(checks_ok),
        }
        return json.dumps(output, separators=(",", ":"))
    except Exception as exc:
        # A serializable error lets the interactive JS page stay alive.
        print("[ERROR] Quantum bridge could not complete: {}".format(str(exc)[:300]))
        return json.dumps({"ok": False, "error": str(exc)[:300]})
