"""Basic-gate Trotter circuits and a matched NumPy statevector fallback.

The circuit uses only RX, RZ, RXX and RYY gates plus X preparation and
measurement. A single backend job can contain all selected-topology time points.
"""

import numpy as np
from battery.model import initial_state, topology_edges


def _single_gate(state, qubit, matrix):
    stride = 1 << int(qubit)
    for base in range(len(state)):
        if (base & stride) == 0:
            partner = base | stride
            amp0, amp1 = state[base], state[partner]
            state[base] = matrix[0, 0] * amp0 + matrix[0, 1] * amp1
            state[partner] = matrix[1, 0] * amp0 + matrix[1, 1] * amp1
    return state


def _two_qubit_rotation(state, qubit_a, qubit_b, theta, pauli):
    """Apply RXX(theta) or RYY(theta); qubit indices are Qiskit little-endian."""
    identity = np.eye(4, dtype=complex)
    if pauli == "x":
        p = np.array([[0, 1], [1, 0]], dtype=complex)
    elif pauli == "y":
        p = np.array([[0, -1j], [1j, 0]], dtype=complex)
    else:
        raise ValueError("pauli must be 'x' or 'y'")
    unitary = np.cos(theta / 2.0) * identity - 1j * np.sin(theta / 2.0) * np.kron(p, p)
    mask_a, mask_b = 1 << int(qubit_a), 1 << int(qubit_b)
    both = mask_a | mask_b
    for base in range(len(state)):
        if (base & both) == 0:
            indices = [base, base | mask_a, base | mask_b, base | both]
            local = state[indices].copy()
            state[indices] = unitary @ local
    return state


def trotter_step_state(state, n_cells, topology, omega, drive, coupling, dt):
    """Apply one symmetric second-order product-formula step to a statevector."""
    edges = topology_edges(topology, n_cells)
    angle_z_half = -float(omega) * float(dt) / 2.0
    angle_drive_half = float(drive) * float(dt) / np.sqrt(n_cells)

    # exp(-i H_z dt/2); RZ implements the non-constant part of omega |1><1|.
    for qubit in range(n_cells):
        rz = np.diag([np.exp(-1j * angle_z_half / 2.0), np.exp(1j * angle_z_half / 2.0)])
        _single_gate(state, qubit, rz)
    if topology == "star":
        rz = np.diag([np.exp(-1j * angle_z_half / 2.0), np.exp(1j * angle_z_half / 2.0)])
        _single_gate(state, n_cells, rz)

    # exp(-i H_drive dt/2).
    rx = np.array([
        [np.cos(angle_drive_half / 2.0), -1j * np.sin(angle_drive_half / 2.0)],
        [-1j * np.sin(angle_drive_half / 2.0), np.cos(angle_drive_half / 2.0)],
    ], dtype=complex)
    for qubit in range(n_cells):
        _single_gate(state, qubit, rx)

    # Each edge term is evolved for dt/2 in forward then reverse order,
    # giving a symmetric second-order splitting for the set of noncommuting edges.
    if edges and coupling != 0.0:
        half_edge_angle = float(coupling) * float(dt) / (2.0 * np.sqrt(len(edges)))
        for edge in edges:
            _two_qubit_rotation(state, edge[0], edge[1], half_edge_angle, "x")
            _two_qubit_rotation(state, edge[0], edge[1], half_edge_angle, "y")
        for edge in reversed(edges):
            _two_qubit_rotation(state, edge[0], edge[1], half_edge_angle, "x")
            _two_qubit_rotation(state, edge[0], edge[1], half_edge_angle, "y")

    for qubit in range(n_cells):
        _single_gate(state, qubit, rx)

    if topology == "star":
        rz = np.diag([np.exp(-1j * angle_z_half / 2.0), np.exp(1j * angle_z_half / 2.0)])
        _single_gate(state, n_cells, rz)
    for qubit in range(n_cells):
        rz = np.diag([np.exp(-1j * angle_z_half / 2.0), np.exp(1j * angle_z_half / 2.0)])
        _single_gate(state, qubit, rz)
    return state


def trotter_statevector_curve(n_cells, topology, omega, drive, coupling, t_max, steps):
    """Simulate the same Trotter gate sequence in NumPy, mainly for validation/fallback."""
    times = np.linspace(0.0, float(t_max), int(steps) + 1)
    dt = float(t_max) / int(steps)
    state = initial_state(n_cells, topology)
    energies = []
    states = []
    battery_energy_by_basis = np.array([
        float(omega) * (basis & ((1 << n_cells) - 1)).bit_count()
        for basis in range(1 << (n_cells + 1))
    ])
    for index, time in enumerate(times):
        if index > 0:
            trotter_step_state(state, n_cells, topology, omega, drive, coupling, dt)
        energies.append(float(np.dot(np.abs(state) ** 2, battery_energy_by_basis)))
        states.append(state.copy())
    return times, np.asarray(energies), states


def build_trotter_circuit(n_cells, topology, omega, drive, coupling, t_index, steps, t_max):
    """Build measured circuit for t=t_index*t_max/steps with second-order Trotter steps."""
    from qiskit import QuantumCircuit

    total_qubits = int(n_cells) + 1
    circuit = QuantumCircuit(total_qubits, total_qubits)
    hub = int(n_cells)
    if topology == "star":
        circuit.x(hub)  # One initially excited charger/hub quantum in the star case.

    edges = topology_edges(topology, n_cells)
    dt = float(t_max) / int(steps)
    angle_z_half = -float(omega) * dt / 2.0
    angle_drive_half = float(drive) * dt / np.sqrt(n_cells)
    half_edge_angle = 0.0 if not edges else float(coupling) * dt / (2.0 * np.sqrt(len(edges)))

    for _ in range(int(t_index)):
        for qubit in range(n_cells):
            circuit.rz(angle_z_half, qubit)
        if topology == "star":
            circuit.rz(angle_z_half, hub)
        for qubit in range(n_cells):
            circuit.rx(angle_drive_half, qubit)
        if edges and coupling != 0.0:
            for edge in edges:
                circuit.rxx(half_edge_angle, edge[0], edge[1])
                circuit.ryy(half_edge_angle, edge[0], edge[1])
            for edge in reversed(edges):
                circuit.rxx(half_edge_angle, edge[0], edge[1])
                circuit.ryy(half_edge_angle, edge[0], edge[1])
        for qubit in range(n_cells):
            circuit.rx(angle_drive_half, qubit)
        if topology == "star":
            circuit.rz(angle_z_half, hub)
        for qubit in range(n_cells):
            circuit.rz(angle_z_half, qubit)

    circuit.measure(range(total_qubits), range(total_qubits))
    return circuit


def battery_energy_from_counts(counts, n_cells, omega):
    """Estimate H_B from counts; rightmost n_cells bits are battery qubits."""
    total = sum(int(count) for count in counts.values())
    if total <= 0:
        raise ValueError("Measurement counts are empty.")
    excitation_sum = 0.0
    for bitstring, count in counts.items():
        clean = str(bitstring).replace(" ", "").replace("_", "")
        battery_bits = clean[-int(n_cells):]
        excitation_sum += int(count) * battery_bits.count("1")
    return float(omega) * excitation_sum / total


def battery_energy_stats_from_counts(counts, n_cells, omega):
    """Return sampled stored-energy mean and standard error from Z-basis counts."""
    total = sum(int(count) for count in counts.values())
    if total <= 0:
        raise ValueError("Measurement counts are empty.")
    values, weights = [], []
    for bitstring, count in counts.items():
        clean = str(bitstring).replace(" ", "").replace("_", "")
        battery_bits = clean[-int(n_cells):]
        values.append(float(omega) * battery_bits.count("1"))
        weights.append(int(count))
    values = np.asarray(values, dtype=float)
    weights = np.asarray(weights, dtype=float)
    mean = float(np.dot(values, weights) / total)
    variance = float(np.dot((values - mean) ** 2, weights) / total)
    return mean, float(np.sqrt(max(0.0, variance) / total))

def sample_statevector_counts(state, shots, seed=20261012):
    """Deterministically seeded measurement sample for the clearly labelled fallback."""
    probabilities = np.abs(np.asarray(state, dtype=complex)) ** 2
    probabilities = probabilities / probabilities.sum()
    rng = np.random.default_rng(int(seed))
    frequencies = rng.multinomial(int(shots), probabilities)
    width = int(round(np.log2(len(probabilities))))
    return {
        format(index, "0{}b".format(width)): int(count)
        for index, count in enumerate(frequencies) if count > 0
    }
