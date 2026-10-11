"""Exact small-system quantum-battery models and observables.

All parameters are dimensionless toy values (hbar=1). Battery cells have
H_B = omega * sum_i |1><1|. A shared local drive acts on all cells, and each
topology adds normalized exchange couplings. The star uses one extra, initially
excited hub/charger qubit; this extra energy resource is disclosed in the UI.
"""

import itertools
import numpy as np

TOPOLOGIES = ("star", "chain", "all-to-all", "parallel")


def topology_edges(topology: str, n_cells: int):
    """Return edges (a,b), where the hub qubit index is n_cells for star."""
    n_cells = int(n_cells)
    if topology == "star":
        return [(n_cells, i) for i in range(n_cells)]
    if topology == "chain":
        return [(i, i + 1) for i in range(n_cells - 1)]
    if topology == "all-to-all":
        return list(itertools.combinations(range(n_cells), 2))
    if topology == "parallel":
        return []
    raise ValueError("Unknown topology: {}".format(topology))


def validate_settings(n_cells, omega, drive, coupling, t_max, steps, shots):
    n_cells = int(n_cells)
    steps = int(steps)
    shots = int(shots)
    omega, drive, coupling, t_max = map(float, (omega, drive, coupling, t_max))
    if not 2 <= n_cells <= 7:
        raise ValueError("n_cells must be between 2 and 7.")
    if not all(np.isfinite(v) for v in (omega, drive, coupling, t_max)):
        raise ValueError("All physical settings must be finite.")
    if omega <= 0:
        raise ValueError("omega must be positive.")
    if drive < 0 or coupling < 0:
        raise ValueError("drive and coupling must be non-negative.")
    if t_max <= 0:
        raise ValueError("t_max must be positive.")
    if not 4 <= steps <= 24:
        raise ValueError("steps must be between 4 and 24 to keep runs responsive.")
    if not 100 <= shots <= 4000:
        raise ValueError("shots must be between 100 and 4000.")
    return n_cells, omega, drive, coupling, t_max, steps, shots


def initial_state(n_cells: int, topology: str):
    """Battery starts in |00...0>; star hub starts in |1>, other hubs in |0>."""
    state = np.zeros(1 << (n_cells + 1), dtype=complex)
    index = (1 << n_cells) if topology == "star" else 0
    state[index] = 1.0 + 0.0j
    return state


def build_total_hamiltonian(n_cells: int, topology: str, omega: float, drive: float, coupling: float):
    """Dense real-symmetric total Hamiltonian for exact small-system evolution.

    Drive coefficient per battery cell is drive/sqrt(N), so the Euclidean norm
    of the local-drive coefficient vector is drive for every topology. For M
    edges, each exchange edge has matrix element coupling/sqrt(M); the squared
    edge-weight budget is therefore topology-normalized. The star has an extra
    excited hub with bare energy omega, an explicit resource difference.
    """
    n_cells = int(n_cells)
    total_qubits = n_cells + 1
    dimension = 1 << total_qubits
    hamiltonian = np.zeros((dimension, dimension), dtype=float)
    battery_mask = (1 << n_cells) - 1
    drive_coeff = float(drive) / np.sqrt(n_cells)

    for basis in range(dimension):
        excitations = (basis & battery_mask).bit_count()
        energy = float(omega) * excitations
        if topology == "star" and ((basis >> n_cells) & 1):
            energy += float(omega)
        hamiltonian[basis, basis] = energy

    # Local transverse charging drive: drive/sqrt(N) * sum_i X_i.
    for basis in range(dimension):
        for qubit in range(n_cells):
            hamiltonian[basis, basis ^ (1 << qubit)] += drive_coeff

    edges = topology_edges(topology, n_cells)
    if edges and coupling != 0.0:
        edge_coeff = float(coupling) / np.sqrt(len(edges))
        for basis in range(dimension):
            for qubit_a, qubit_b in edges:
                bit_a = (basis >> qubit_a) & 1
                bit_b = (basis >> qubit_b) & 1
                # H_edge = g/(2 sqrt(M)) * (XX + YY); it exchanges |01> and |10>
                # with matrix element g/sqrt(M), and does not couple |00> to |11>.
                if bit_a != bit_b:
                    target = basis ^ (1 << qubit_a) ^ (1 << qubit_b)
                    hamiltonian[basis, target] += edge_coeff

    return hamiltonian


def evolve_exact_curve(n_cells: int, topology: str, omega: float, drive: float, coupling: float, times):
    """Exact spectral evolution for a static Hamiltonian, plus battery observables."""
    hamiltonian = build_total_hamiltonian(n_cells, topology, omega, drive, coupling)
    eigenvalues, eigenvectors = np.linalg.eigh(hamiltonian)
    psi0 = initial_state(n_cells, topology)
    coefficients = eigenvectors.conj().T @ psi0
    total_energy_initial = float(np.vdot(psi0, hamiltonian @ psi0).real)
    battery_energies = np.array([
        omega * (basis & ((1 << n_cells) - 1)).bit_count()
        for basis in range(1 << (n_cells + 1))
    ], dtype=float)
    energies, powers, ergots, norms, total_energies, states = [], [], [], [], [], []
    bare_levels = np.array([
        omega * basis.bit_count() for basis in range(1 << n_cells)
    ], dtype=float)
    bare_levels.sort()

    for time in times:
        psi = eigenvectors @ (np.exp(-1j * eigenvalues * float(time)) * coefficients)
        states.append(psi)
        norm = float(np.vdot(psi, psi).real)
        total_e = float(np.vdot(psi, hamiltonian @ psi).real)
        battery_energy = float(np.dot(np.abs(psi) ** 2, battery_energies))
        power = battery_energy / float(time) if float(time) > 1e-12 else 0.0

        if topology == "star":
            # Index layout: low N bits are the battery; most-significant bit is hub.
            amplitude_matrix = psi.reshape(2, 1 << n_cells)
            rho_battery = amplitude_matrix.T @ amplitude_matrix.conj()
            rho_battery = (rho_battery + rho_battery.conj().T) / 2.0
            populations = np.linalg.eigvalsh(rho_battery)
            populations = np.clip(populations, 0.0, None)[::-1]
            passive_energy = float(np.dot(populations, bare_levels))
            ergotropy = battery_energy - passive_energy
            if ergotropy < -1e-8:
                raise ArithmeticError("Calculated ergotropy is negative beyond tolerance.")
            ergotropy = max(0.0, float(ergotropy))
        else:
            # Without a coupled hub, the battery state remains pure; its passive
            # rearrangement puts its only nonzero eigenvalue on the ground level.
            ergotropy = battery_energy

        energies.append(battery_energy)
        powers.append(power)
        ergots.append(ergotropy)
        norms.append(norm)
        total_energies.append(total_e)

    return {
        "times": np.asarray(times, dtype=float),
        "energy": np.asarray(energies),
        "power": np.asarray(powers),
        "ergotropy": np.asarray(ergots),
        "norms": np.asarray(norms),
        "total_energy": np.asarray(total_energies),
        "total_energy_initial": total_energy_initial,
        "hamiltonian": hamiltonian,
        "states": states,
    }


def two_cell_analytic_energy(time: float, omega: float, drive: float):
    """Analytic E_B(t) for N=2, coupling=0, with the shared local X drive.

    Each cell evolves under H = omega |1><1| + a X, a=drive/sqrt(2).
    P_exc(t) = 4 a^2/(omega^2+4a^2) * sin^2(0.5*sqrt(omega^2+4a^2)*t).
    The total battery energy is 2*omega*P_exc(t).
    """
    a = float(drive) / np.sqrt(2.0)
    frequency = np.sqrt(float(omega) ** 2 + 4.0 * a ** 2)
    denominator = float(omega) ** 2 + 4.0 * a ** 2
    p_excited = (4.0 * a ** 2 / denominator) * np.sin(0.5 * frequency * float(time)) ** 2
    return float(2.0 * float(omega) * p_excited)
