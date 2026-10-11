# Qollab submission form

## Project title
Quantum Battery Lab: Exploring Collective Charging

## Project description (under 240 characters)
Explore four quantum-battery charging topologies with live energy, power and ergotropy curves. Try guided missions, animate the timeline, and optionally compare Qiskit Trotter measurements against exact classical dynamics.

## Theme
Quantum Unlocked

## Project shape
JS / Qiskit wrapper. Required root files: `index.html`, `main.js`, `main.css`.

## What didn't work?
The initial Python-only version showed the numerical comparison mainly in console plots and was not very interactive. This edition moves the explorer to a responsive JavaScript interface with live controls and charts, while keeping circuit validation optional. The Python-to-JavaScript import/call bridge and JS project backend integration remain platform-side tests; if they fail, the classical interactive explainer remains usable and the UI should clearly label that result as unavailable or a fallback.

## A version outside Qollab runs on an IonQ backend?
No. Do not check this box unless a separate outside-Qollab version has actually been deployed and tested on IonQ.

## Dependencies / environment
No external JavaScript dependencies. Uses Qollab's documented Python bridge for the optional Qiskit circuit run; the bridge imports Qiskit and NumPy provided by Qollab. No external API keys.
