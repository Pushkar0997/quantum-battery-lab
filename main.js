import * as batteryBridge from 'quantum.demo';

const TOPOLOGIES = ['star', 'chain', 'all-to-all', 'parallel'];
const TOPOLOGY_INFO = {
  star: { label: 'Star hub', short: 'STAR', color: '#4be2f2', desc: 'An initially excited auxiliary hub couples to every battery cell. Its energy is an extra resource, so the star result is descriptive rather than a resource-independent advantage.' },
  chain: { label: 'Nearest-neighbour chain', short: 'CHAIN', color: '#ffad72', desc: 'Each cell exchanges excitations only with its neighbours. The local drive supplies energy while the chain interaction redistributes excitations.' },
  'all-to-all': { label: 'All-to-all', short: 'ALL-TO-ALL', color: '#af8bff', desc: 'Every pair of battery cells is connected. Edge weights are normalized so their squared coefficients share the same total budget as other topologies.' },
  parallel: { label: 'Parallel baseline', short: 'PARALLEL', color: '#a3efaa', desc: 'Each cell is driven independently without interaction edges. This is the reference for what the shared local drive can do on its own.' }
};
const state = {
  settings: { topology: 'star', nCells: 3, omega: 1, drive: 0.7, coupling: 0.8, tMax: 3, steps: 24, shots: 1000 },
  curves: {}, visible: { star: true, chain: true, 'all-to-all': true, parallel: true },
  scrubIndex: 12,
  quantum: null,
  running: false,
  isPlaying: false,
  playbackRequest: null,
  playbackLast: 0,
  activeMission: null
};
const COLORS = Object.fromEntries(TOPOLOGIES.map(key => [key, TOPOLOGY_INFO[key].color]));
const $ = (id) => document.getElementById(id);

function popcount(x) {
  let count = 0; x = x >>> 0;
  while (x) { count += x & 1; x >>>= 1; }
  return count;
}
function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
function fmt(value, digits = 3) { return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'; }
function safeNumber(value, fallback) { const x = Number(value); return Number.isFinite(x) ? x : fallback; }
function getSettings() {
  return {
    topology: state.settings.topology,
    nCells: Number($('cells').value),
    omega: Number($('omega').value),
    drive: Number($('drive').value),
    coupling: Number($('coupling').value),
    tMax: Number($('horizon').value),
    steps: Number($('resolution').value),
    shots: Number($('shots')?.value || state.settings.shots)
  };
}
function updateSettingLabels() {
  const s = getSettings();
  $('cells-value').textContent = s.nCells;
  $('omega-value').textContent = fmt(s.omega, 2);
  $('drive-value').textContent = fmt(s.drive, 2);
  $('coupling-value').textContent = fmt(s.coupling, 2);
  $('horizon-value').textContent = fmt(s.tMax, 2);
  $('resolution-value').textContent = s.steps;
  if ($('shots-value')) $('shots-value').textContent = s.shots;
  state.settings = { ...state.settings, ...s };
  $('hero-cell-count').textContent = String(s.nCells).padStart(2, '0') + ' CELLS';
  $('scrub-end-label').textContent = 't = ' + fmt(s.tMax, 2);
  $('time-scrub').max = s.steps;
  $('time-scrub').value = clamp(Number($('time-scrub').value), 0, s.steps);
  state.scrubIndex = Number($('time-scrub').value);
  updateTopologySelection();
  renderTopologySvg($('hero-topology'), s, true);
  renderTopologySvg($('main-topology'), s, false);
}
function topologyIcon(kind) {
  const common = 'viewBox="0 0 32 32" aria-hidden="true"';
  if (kind === 'star') return `<svg ${common}><path d="M16 5V13M16 13L6 24M16 13L26 24M16 13V26"/><circle cx="16" cy="5" r="3"/><circle cx="6" cy="24" r="3"/><circle cx="26" cy="24" r="3"/><circle cx="16" cy="26" r="3"/><circle cx="16" cy="13" r="3"/></svg>`;
  if (kind === 'chain') return `<svg ${common}><path d="M5 16H27"/><circle cx="5" cy="16" r="3"/><circle cx="16" cy="16" r="3"/><circle cx="27" cy="16" r="3"/></svg>`;
  if (kind === 'all-to-all') return `<svg ${common}><path d="M6 7L26 25M6 25L26 7M6 7L6 25M26 7L26 25M6 7L26 7M6 25L26 25"/><circle cx="6" cy="7" r="3"/><circle cx="26" cy="7" r="3"/><circle cx="6" cy="25" r="3"/><circle cx="26" cy="25" r="3"/></svg>`;
  return `<svg ${common}><path d="M5 16H27" stroke-dasharray="2 4"/><circle cx="5" cy="16" r="3"/><circle cx="16" cy="16" r="3"/><circle cx="27" cy="16" r="3"/></svg>`;
}
function updateTopologySelection() {
  document.querySelectorAll('.topology-choice').forEach(button => {
    const active = button.dataset.topology === state.settings.topology;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.choice-icon').forEach(icon => { icon.innerHTML = topologyIcon(icon.dataset.icon); });
  const info = TOPOLOGY_INFO[state.settings.topology];
  $('hero-topology-name').textContent = info.short + (state.settings.topology === 'star' ? ' CHARGER' : ' TOPOLOGY');
  const description = $('topology-description');
  description.innerHTML = `<strong>${info.label}</strong><span>${info.desc}</span>`;
}
function renderTopologySvg(svg, settings, compact) {
  if (!svg) return;
  const w = 760, h = 300, n = settings.nCells, topology = settings.topology;
  let nodes = [];
  if (topology === 'all-to-all') {
    const cx = 380, cy = 150, rx = Math.min(285, 42 * n), ry = 90;
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + 2 * Math.PI * i / n;
      nodes.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }
  } else {
    const left = n <= 3 ? 220 : 72, right = n <= 3 ? 540 : 688;
    for (let i = 0; i < n; i++) nodes.push({ x: n === 1 ? 380 : left + (right - left) * i / (n - 1), y: topology === 'star' ? 215 + Math.sin(i * 1.5) * 3 : 151 + Math.sin(i * 1.35) * (topology === 'parallel' ? 0 : 7) });
  }
  const edges = [];
  if (topology === 'star') {
    const hub = { x: 380, y: 60 };
    nodes.forEach((node, i) => edges.push({ a: hub, b: node, idx: i }));
  } else if (topology === 'chain') {
    for (let i = 0; i < n - 1; i++) edges.push({ a: nodes[i], b: nodes[i + 1], idx: i });
  } else if (topology === 'all-to-all') {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ a: nodes[i], b: nodes[j], idx: i + j });
  }
  const lines = edges.map((edge, i) => `<line class="edge active-edge" x1="${edge.a.x}" y1="${edge.a.y}" x2="${edge.b.x}" y2="${edge.b.y}" style="animation-delay:${i * 55}ms;opacity:${topology === 'all-to-all' ? .33 : .75}"/>`).join('');
  const nodeMarkup = nodes.map((node, i) => `<g class="battery-node" style="animation-delay:${i * 70}ms"><circle class="node-pulse" cx="${node.x}" cy="${node.y}" r="23"/><circle class="node" cx="${node.x}" cy="${node.y}" r="18"/><text class="node-label" x="${node.x}" y="${node.y}">B${i + 1}</text><path class="energy-arrow" d="M${node.x} ${node.y - 29}v-9m-4 4l4 -4l4 4"/></g>`).join('');
  let hubMarkup = '';
  if (topology === 'star') hubMarkup = `<g><circle class="node-pulse" cx="380" cy="60" r="28"/><polygon class="node-charger" points="380,38 400,49 400,71 380,82 360,71 360,49"/><text class="node-label" x="380" y="60">H</text><text class="charger-label" x="380" y="24">CHARGER HUB</text></g>`;
  const modeLabel = topology === 'star' ? 'HUB-TO-CELL COUPLING' : topology === 'chain' ? 'NEAREST-NEIGHBOUR EXCHANGE' : topology === 'all-to-all' ? 'PAIRWISE EXCHANGE GRAPH' : 'INDEPENDENT LOCAL DRIVES';
  const budgetLabel = topology === 'parallel' ? 'M = 0 edges' : `M = ${edges.length} ${edges.length === 1 ? 'edge' : 'edges'}`;
  svg.innerHTML = `<defs><linearGradient id="cell-grad-${compact ? 'hero' : 'main'}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#173e61"/><stop offset="100%" stop-color="#10243c"/></linearGradient></defs><g>${lines}</g><g>${hubMarkup}${nodeMarkup}</g><g><text class="edge-label" x="22" y="278">${modeLabel}</text><text class="edge-label" x="738" y="278" text-anchor="end">${budgetLabel}</text></g>`;
}

function topologyEdges(topology, n) {
  const edges = [];
  if (topology === 'star') for (let i = 0; i < n; i++) edges.push([n, i]);
  if (topology === 'chain') for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
  if (topology === 'all-to-all') for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j]);
  return edges;
}
function buildSparseModel(n, topology, omega, drive, coupling) {
  const q = n + 1, dim = 1 << q, mask = (1 << n) - 1;
  const diagonal = new Float64Array(dim), neighbours = Array.from({ length: dim }, () => []);
  const edgeList = topologyEdges(topology, n);
  const edgeCoefficient = edgeList.length ? coupling / Math.sqrt(edgeList.length) : 0;
  const driveCoefficient = drive / Math.sqrt(n);
  const batteryExcitations = new Uint8Array(dim);
  for (let basis = 0; basis < dim; basis++) {
    const excitations = popcount(basis & mask);
    batteryExcitations[basis] = excitations;
    diagonal[basis] = omega * excitations + (topology === 'star' && ((basis >> n) & 1) ? omega : 0);
    for (let i = 0; i < n; i++) neighbours[basis].push([basis ^ (1 << i), driveCoefficient]);
    for (const [a, b] of edgeList) {
      const bitA = (basis >> a) & 1, bitB = (basis >> b) & 1;
      if (bitA !== bitB) neighbours[basis].push([basis ^ (1 << a) ^ (1 << b), edgeCoefficient]);
    }
  }
  return { n, topology, omega, dim, diagonal, neighbours, batteryExcitations };
}
function makeWorkspace(dim) {
  const array = () => new Float64Array(dim);
  return { hr: array(), hi: array(), k1r: array(), k1i: array(), k2r: array(), k2i: array(), k3r: array(), k3i: array(), k4r: array(), k4i: array(), tr: array(), ti: array() };
}
function derivative(re, im, outR, outI, model, hr, hi) {
  const { diagonal, neighbours, dim } = model;
  for (let i = 0; i < dim; i++) {
    let rr = diagonal[i] * re[i], ii = diagonal[i] * im[i];
    for (const [j, coefficient] of neighbours[i]) { rr += coefficient * re[j]; ii += coefficient * im[j]; }
    hr[i] = rr; hi[i] = ii;
    outR[i] = ii; outI[i] = -rr; // d|psi>/dt = -i H |psi>
  }
}
function makeIntermediate(outR, outI, re, im, kR, kI, factor) {
  for (let i = 0; i < re.length; i++) { outR[i] = re[i] + factor * kR[i]; outI[i] = im[i] + factor * kI[i]; }
}
function rk4Step(re, im, model, dt, w) {
  derivative(re, im, w.k1r, w.k1i, model, w.hr, w.hi);
  makeIntermediate(w.tr, w.ti, re, im, w.k1r, w.k1i, dt / 2);
  derivative(w.tr, w.ti, w.k2r, w.k2i, model, w.hr, w.hi);
  makeIntermediate(w.tr, w.ti, re, im, w.k2r, w.k2i, dt / 2);
  derivative(w.tr, w.ti, w.k3r, w.k3i, model, w.hr, w.hi);
  makeIntermediate(w.tr, w.ti, re, im, w.k3r, w.k3i, dt);
  derivative(w.tr, w.ti, w.k4r, w.k4i, model, w.hr, w.hi);
  const sixth = dt / 6;
  for (let i = 0; i < re.length; i++) {
    re[i] += sixth * (w.k1r[i] + 2 * w.k2r[i] + 2 * w.k3r[i] + w.k4r[i]);
    im[i] += sixth * (w.k1i[i] + 2 * w.k2i[i] + 2 * w.k3i[i] + w.k4i[i]);
  }
}
function getObservables(re, im, model, t) {
  const { n, topology, omega, dim, diagonal, neighbours, batteryExcitations } = model;
  let norm = 0, energy = 0, hEnergy = 0, pHub0 = 0, pHub1 = 0, offR = 0, offI = 0;
  const hr = new Float64Array(dim), hi = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    const probability = re[i] * re[i] + im[i] * im[i];
    norm += probability;
    energy += probability * omega * batteryExcitations[i];
    let rr = diagonal[i] * re[i], ii = diagonal[i] * im[i];
    for (const [j, c] of neighbours[i]) { rr += c * re[j]; ii += c * im[j]; }
    hr[i] = rr; hi[i] = ii;
    hEnergy += re[i] * rr + im[i] * ii;
  }
  if (topology === 'star') {
    const hubMask = 1 << n;
    for (let b = 0; b < hubMask; b++) {
      const r0 = re[b], i0 = im[b], r1 = re[b | hubMask], i1 = im[b | hubMask];
      pHub0 += r0 * r0 + i0 * i0; pHub1 += r1 * r1 + i1 * i1;
      offR += r0 * r1 + i0 * i1;
      offI += i0 * r1 - r0 * i1;
    }
  }
  const power = t > 1e-12 ? energy / t : 0;
  let ergotropy = energy;
  if (topology === 'star') {
    const discriminant = Math.sqrt(Math.max(0, (pHub0 - pHub1) ** 2 + 4 * (offR * offR + offI * offI)));
    const smallerEigenvalue = clamp((1 - discriminant) / 2, 0, 0.5);
    // The passive state puts the largest battery eigenvalue at E=0 and the
    // second at the first excited level omega; all remaining eigenvalues vanish.
    ergotropy = energy - omega * smallerEigenvalue;
  }
  return { energy, power, ergotropy: Math.max(0, ergotropy), norm, totalEnergy: hEnergy };
}
function simulateTopology(settings, topology, options = {}) {
  const { nCells: n, omega, drive, coupling, tMax, steps } = settings;
  const model = buildSparseModel(n, topology, omega, drive, coupling);
  const re = new Float64Array(model.dim), im = new Float64Array(model.dim);
  const initialIndex = topology === 'star' ? (1 << n) : 0;
  re[initialIndex] = 1;
  const workspace = makeWorkspace(model.dim);
  const times = [], energy = [], power = [], ergotropy = [], norms = [], totalEnergy = [];
  const interval = tMax / steps;
  const innerSteps = Math.max(1, Math.ceil(interval / 0.008));
  const dt = interval / innerSteps;
  let totalEnergyInitial = null;
  for (let k = 0; k <= steps; k++) {
    const t = k * interval;
    const obs = getObservables(re, im, model, t);
    if (totalEnergyInitial === null) totalEnergyInitial = obs.totalEnergy;
    times.push(t); energy.push(obs.energy); power.push(obs.power); ergotropy.push(obs.ergotropy); norms.push(obs.norm); totalEnergy.push(obs.totalEnergy);
    if (k < steps) for (let sub = 0; sub < innerSteps; sub++) rk4Step(re, im, model, dt, workspace);
  }
  return { topology, times, energy, power, ergotropy, norms, totalEnergy, totalEnergyInitial };
}
function simulateAll(settings) {
  const started = Date.now();
  const curves = {};
  for (const topology of TOPOLOGIES) curves[topology] = simulateTopology(settings, topology);
  return { curves, elapsedMs: Date.now() - started };
}
function twoCellAnalyticEnergy(t, omega, drive) {
  const a = drive / Math.sqrt(2), frequency = Math.sqrt(omega * omega + 4 * a * a);
  return 2 * omega * (4 * a * a / (omega * omega + 4 * a * a)) * Math.sin(frequency * t / 2) ** 2;
}
function runClientChecks(settings, curves) {
  const checks = [];
  let normWorst = 0, driftWorst = 0, boundsOk = true, startOk = true;
  for (const topology of TOPOLOGIES) {
    const c = curves[topology];
    normWorst = Math.max(normWorst, ...c.norms.map(x => Math.abs(x - 1)));
    driftWorst = Math.max(driftWorst, ...c.totalEnergy.map(x => Math.abs(x - c.totalEnergyInitial)));
    if (c.energy.some((e, i) => c.ergotropy[i] < -1e-7 || c.ergotropy[i] > e + 1e-6)) boundsOk = false;
    if (Math.abs(c.energy[0]) > 1e-10 || Math.abs(c.ergotropy[0]) > 1e-10) startOk = false;
  }
  checks.push({ label: 'Client-side state norm stays within 1e-7', pass: normWorst < 1e-7, detail: `worst deviation ${normWorst.toExponential(2)}` });
  checks.push({ label: 'Time-independent total energy is conserved', pass: driftWorst < 1e-6, detail: `worst drift ${driftWorst.toExponential(2)}` });
  checks.push({ label: 'At t = 0 stored energy and ergotropy vanish', pass: startOk, detail: 'all four topologies' });
  checks.push({ label: 'Ergotropy remains between zero and stored energy', pass: boundsOk, detail: 'checked at all displayed times' });
  const smallSettings = { ...settings, nCells: 2, steps: 8, tMax: 1.2, drive: .45, coupling: 0 };
  const smallParallel = simulateTopology(smallSettings, 'parallel');
  let analyticError = 0;
  smallParallel.times.forEach((t, i) => { analyticError = Math.max(analyticError, Math.abs(smallParallel.energy[i] - twoCellAnalyticEnergy(t, smallSettings.omega, smallSettings.drive))); });
  checks.push({ label: 'Two-cell closed form matches numerical evolution', pass: analyticError < 2e-5, detail: `maximum energy error ${analyticError.toExponential(2)}` });
  const zeroSettings = { ...settings, coupling: 0, nCells: 3, steps: 8, tMax: 1.2 };
  const zeroBase = simulateTopology(zeroSettings, 'parallel');
  let zeroDiff = 0;
  for (const topology of ['star', 'chain', 'all-to-all']) {
    const c = simulateTopology(zeroSettings, topology);
    c.energy.forEach((e, i) => { zeroDiff = Math.max(zeroDiff, Math.abs(e - zeroBase.energy[i])); });
  }
  checks.push({ label: 'Zero coupling matches the independent-drive baseline', pass: zeroDiff < 2e-6, detail: `maximum difference ${zeroDiff.toExponential(2)}` });
  return checks;
}
function renderChecks(checks) {
  return checks.map(c => `<div class="check-row ${c.pass ? 'check-pass' : 'check-fail'}"><span>${c.pass ? '✓' : '!'}</span><div><strong>${c.label}</strong><small>${c.detail}</small></div></div>`).join('');
}
function renderMetricSparkline(className, values, color) {
  if (!values || values.length < 2) return;
  const w = 150, h = 32, max = Math.max(1e-9, ...values);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1) * w).toFixed(1)},${(h - 2 - v / max * (h - 4)).toFixed(1)}`).join(' ');
  const el = document.querySelector('.' + className);
  if (el) el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}
function renderLegend() {
  $('chart-legend').innerHTML = TOPOLOGIES.map(key => `<button class="legend-button ${state.visible[key] ? '' : 'off'}" data-visible="${key}" type="button" aria-pressed="${state.visible[key]}"><i class="legend-line-swatch" style="background:${COLORS[key]}"></i>${TOPOLOGY_INFO[key].short}</button>`).join('');
}
function pathFor(values, xMap, yMap) {
  return values.map((value, i) => `${i ? 'L' : 'M'}${xMap(i).toFixed(2)},${yMap(value).toFixed(2)}`).join(' ');
}
function drawChart(containerId, metric, curves, settings) {
  const W = 720, H = 238, left = 53, right = 13, top = 15, bottom = 38;
  const pw = W - left - right, ph = H - top - bottom;
  const allValues = TOPOLOGIES.filter(k => state.visible[k]).flatMap(k => curves[k][metric]);
  let ymax = Math.max(0.05, ...allValues) * 1.16;
  if (metric === 'energy' || metric === 'ergotropy') ymax = Math.max(ymax, settings.omega * settings.nCells * 0.45);
  const xMap = i => left + (i / Math.max(1, settings.steps)) * pw;
  const yMap = val => top + ph - clamp(val / ymax, 0, 1.1) * ph;
  let svg = `<svg viewBox="0 0 ${W} ${H}" tabindex="0" role="slider" aria-label="${metric} chart; click or use arrow keys to scrub time" aria-valuemin="0" aria-valuemax="${settings.steps}" aria-valuenow="${state.scrubIndex}" aria-valuetext="time ${fmt(settings.tMax*state.scrubIndex/settings.steps,2)}"><title>${metric} comparison versus time; click to select a time point</title>`;
  for (let tick = 0; tick <= 4; tick++) {
    const v = ymax * tick / 4, y = yMap(v);
    svg += `<line class="grid-line" x1="${left}" y1="${y}" x2="${W-right}" y2="${y}"/><text class="axis-text" x="${left-9}" y="${y+3}" text-anchor="end">${v.toFixed(metric === 'power' ? 2 : 1)}</text>`;
  }
  for (let tick = 0; tick <= 4; tick++) {
    const x = left + pw * tick / 4, t = settings.tMax * tick / 4;
    svg += `<line class="grid-line" x1="${x}" y1="${top}" x2="${x}" y2="${top+ph}"/><text class="axis-text" x="${x}" y="${H-14}" text-anchor="middle">${t.toFixed(1)}</text>`;
  }
  svg += `<line class="axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${top+ph}"/><line class="axis-line" x1="${left}" y1="${top+ph}" x2="${W-right}" y2="${top+ph}"/><text class="axis-text" x="${left+pw/2}" y="${H-2}" text-anchor="middle">Time (model units)</text>`;
  for (const key of TOPOLOGIES) {
    if (!state.visible[key]) continue;
    const curve = curves[key], opacity = key === state.settings.topology ? 1 : .58;
    svg += `<path class="curve-path" d="${pathFor(curve[metric], xMap, yMap)}" stroke="${COLORS[key]}" opacity="${opacity}" stroke-width="${key === state.settings.topology ? 2.9 : 1.9}"/>`;
    const index = clamp(state.scrubIndex, 0, curve[metric].length - 1);
    svg += `<circle cx="${xMap(index)}" cy="${yMap(curve[metric][index])}" r="${key === state.settings.topology ? 4.1 : 3}" fill="${COLORS[key]}" stroke="#071321" stroke-width="1.5"/>`;
  }
  if (metric === 'energy' && state.quantum && state.quantum.topology === state.settings.topology && state.quantum.energy.length === settings.steps + 1) {
    const qValues = state.quantum.energy;
    svg += `<path d="${pathFor(qValues, xMap, yMap)}" fill="none" stroke="#f4f8ff" stroke-width="1.2" stroke-dasharray="3 4" opacity=".8"/>`;
    const stride = Math.max(1, Math.floor(qValues.length / 12));
    for (let i = 0; i < qValues.length; i += stride) {
      const x = xMap(i), y = yMap(qValues[i]), err = state.quantum.stderr[i] || 0;
      svg += `<line class="quantum-error" x1="${x}" y1="${yMap(qValues[i]+err)}" x2="${x}" y2="${yMap(qValues[i]-err)}"/><circle cx="${x}" cy="${y}" r="3.3" fill="#f4f8ff" stroke="#0a1a2c" stroke-width="1.2"/>`;
    }
  }
  const scrubX = xMap(clamp(state.scrubIndex, 0, settings.steps));
  svg += `<line class="scrub-marker" x1="${scrubX}" y1="${top}" x2="${scrubX}" y2="${top+ph}"/><text x="${clamp(scrubX, left+22, W-right-22)}" y="${top+10}" fill="#dcefff" text-anchor="middle" font-size="9" font-family="monospace">t=${fmt(settings.tMax*state.scrubIndex/settings.steps,2)}</text></svg>`;
  $(containerId).innerHTML = svg;
}
function renderCharts() {
  if (!Object.keys(state.curves).length) return;
  renderLegend();
  drawChart('chart-energy', 'energy', state.curves, state.settings);
  drawChart('chart-power', 'power', state.curves, state.settings);
  drawChart('chart-ergotropy', 'ergotropy', state.curves, state.settings);
}
function renderCurrentMetrics() {
  const topology = state.settings.topology, curve = state.curves[topology];
  if (!curve) return;
  const index = clamp(state.scrubIndex, 0, curve.times.length - 1), t = curve.times[index];
  $('metric-energy').innerHTML = `${fmt(curve.energy[index], 3)}<small> units</small>`;
  $('metric-power').innerHTML = `${fmt(curve.power[index], 3)}<small> units</small>`;
  $('metric-ergo').innerHTML = `${fmt(curve.ergotropy[index], 3)}<small> units</small>`;
  $('metric-time').innerHTML = `${fmt(t, 2)}<small> model units</small>`;
  $('metric-energy-foot').textContent = `${TOPOLOGY_INFO[topology].label} · classical model`;
  $('metric-power-foot').textContent = t > 0 ? 'Eᵦ(t) / t' : 'Defined as 0 at t = 0';
  $('scrub-time-label').textContent = 't = ' + fmt(t, 2);
  $('selected-time-title').textContent = 'At t = ' + fmt(t, 2);
  $('selected-time-copy').textContent = `High-resolution classical model · click a chart or play to explore ${state.settings.steps+1} time points`; 
  $('time-values').innerHTML = TOPOLOGIES.map(key => `<span class="time-value-chip"><i style="display:inline-block;background:${COLORS[key]};width:6px;height:6px;border-radius:50%;margin-right:4px"></i>${TOPOLOGY_INFO[key].short} <b>${fmt(state.curves[key].energy[index],2)}</b></span>`).join('');
  renderMetricSparkline('spark-energy', curve.energy, COLORS[topology]);
  renderMetricSparkline('spark-power', curve.power, COLORS[topology]);
  renderMetricSparkline('spark-ergo', curve.ergotropy, COLORS[topology]);
  renderMetricSparkline('spark-time', curve.times, '#a3efaa');
}
function renderRanking() {
  const ranked = TOPOLOGIES.map(key => {
    const c = state.curves[key];
    let peakIndex = 0, peak = -Infinity;
    for (let i = 1; i < c.power.length; i++) if (c.power[i] > peak) { peak = c.power[i]; peakIndex = i; }
    return { key, peak, peakTime: c.times[peakIndex], finalEnergy: c.energy[c.energy.length-1], finalErgotropy: c.ergotropy[c.ergotropy.length-1] };
  }).sort((a,b) => b.peak-a.peak);
  $('ranking-body').innerHTML = ranked.map((r, index) => `<tr class="${r.key === state.settings.topology ? 'selected-row' : ''}"><td><span class="rank-topology"><i class="rank-color" style="background:${COLORS[r.key]}"></i>${TOPOLOGY_INFO[r.key].label}${index === 0 ? '<span class="rank-pill">TOP PEAK</span>' : ''}</span></td><td>${fmt(r.peak,4)}</td><td>${fmt(r.peakTime,2)}</td><td>${fmt(r.finalEnergy,4)}</td><td>${fmt(r.finalErgotropy,4)}</td></tr>`).join('');
}
function renderSelfChecks(checks) {
  const failed = checks.some(c => !c.pass);
  const existing = $('checks-panel');
  if (existing) existing.remove();
  const section = document.createElement('section');
  section.id = 'checks-panel'; section.className = 'checks-panel panel';
  section.innerHTML = `<div class="panel-heading"><div><span class="panel-index">✓</span><h3>Live numerical checks</h3></div><span class="${failed ? 'check-badge fail' : 'check-badge pass'}">${failed ? 'REVIEW REQUIRED' : 'ALL PASS'}</span></div><div class="checks-grid">${renderChecks(checks)}</div>`;
  const workspace = document.querySelector('.workspace-column');
  const after = $('ranking-panel');
  workspace.insertBefore(section, after ? after.nextSibling : null);
}
function statusMessage(text, kind = '') {
  const status = $('quantum-status');
  status.textContent = text;
  status.className = 'quantum-status' + (kind ? ' ' + kind : '');
}
async function runExperiment({ initial = false } = {}) {
  if (state.running) return;
  state.running = true;
  const button = $('run-classical'); button.disabled = true; button.classList.add('is-running');
  const oldLabel = button.innerHTML;
  button.innerHTML = '<span class="loading-dots"><i></i><i></i><i></i></span> Simulating dynamics <span class="button-tail">…</span>';
  if (!initial) statusMessage('Updating the classical reference curves in the browser…');
  await new Promise(resolve => setTimeout(resolve, 20));
  try {
    const settings = getSettings();
    const result = simulateAll(settings);
    state.curves = result.curves;
    state.quantum = null;
    state.scrubIndex = clamp(Number($('time-scrub').value), 0, settings.steps);
    renderCharts(); renderCurrentMetrics(); renderRanking();
    const checks = runClientChecks(settings, state.curves);
    checks.forEach(check => console.log(`[${check.pass ? 'PASS' : 'FAIL'}] ${check.label} (${check.detail})`));
    renderSelfChecks(checks);
    if (!state.activeMission) renderGeneralInsight();
    $('run-classical').setAttribute('aria-label', `Run simulation; last local calculation ${result.elapsedMs} milliseconds`);
    if (!initial) statusMessage(`Classical model recalculated in ${(result.elapsedMs/1000).toFixed(2)} s. Quantum-circuit validation has been cleared; run it again if you changed settings.`, checks.every(c=>c.pass) ? 'success' : 'error');
  } catch (error) {
    statusMessage('Classical simulation failed: ' + String(error?.message || error), 'error');
  } finally {
    state.running = false; button.disabled = false; button.classList.remove('is-running'); button.innerHTML = oldLabel;
  }
}
const MISSION_PRESETS = {
  'power-vs-energy': {
    title: 'Mission 01 · Power vs. stored energy',
    summary: 'Compare the topology with the highest peak average power against the one with the most energy stored at the end of the selected time window.',
    settings: { topology: 'star', nCells: 3, omega: 1.0, drive: 0.7, coupling: 0.8, tMax: 3.0, steps: 24, scrub: 12 }
  },
  'coupling-off': {
    title: 'Mission 02 · Interactions switched off',
    summary: 'Set the edge coupling to zero. With no exchange interaction, the battery energy curves should converge to the independent-drive baseline, within numerical tolerance.',
    settings: { topology: 'chain', nCells: 3, omega: 1.0, drive: 0.7, coupling: 0.0, tMax: 3.0, steps: 24, scrub: 12 }
  },
  'strong-coupling': {
    title: 'Mission 03 · Stronger local exchange',
    summary: 'Increase the edge-coupling budget and watch how the chain trajectory changes; stronger coupling does not guarantee larger final energy or better performance at every time.',
    settings: { topology: 'chain', nCells: 4, omega: 1.0, drive: 0.65, coupling: 1.35, tMax: 3.5, steps: 24, scrub: 12 }
  },
  'scale-up': {
    title: 'Mission 04 · Scale to seven cells',
    summary: 'Expand the toy battery to seven cells and inspect the model checks; the Hilbert space grows exponentially, so the optional circuit workload also becomes more demanding.',
    settings: { topology: 'star', nCells: 7, omega: 1.0, drive: 0.7, coupling: 0.65, tMax: 3.0, steps: 24, scrub: 12 }
  }
};

function stopTimelinePlayback() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  if (state.playbackRequest !== null) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.playbackRequest);
    else clearTimeout(state.playbackRequest);
  }
  state.playbackRequest = null;
  state.playbackLast = 0;
  const button = $('play-timeline');
  if (button) { button.setAttribute('aria-pressed', 'false'); button.innerHTML = '<span class="play-glyph">▶</span> Play trajectory'; }
}

function playbackFrame(timestamp) {
  if (!state.isPlaying) return;
  if (!state.playbackLast) state.playbackLast = timestamp;
  if (timestamp - state.playbackLast >= 145) {
    state.playbackLast = timestamp;
    const max = state.settings.steps;
    if (state.scrubIndex >= max) {
      stopTimelinePlayback();
      return;
    }
    state.scrubIndex += 1;
    $('time-scrub').value = state.scrubIndex;
    renderCharts();
    renderCurrentMetrics();
  }
  state.playbackRequest = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(playbackFrame)
    : setTimeout(() => playbackFrame(Date.now()), 40);
}

function toggleTimelinePlayback() {
  if (state.isPlaying) { stopTimelinePlayback(); return; }
  if (!Object.keys(state.curves).length) return;
  if (state.scrubIndex >= state.settings.steps) {
    state.scrubIndex = 0;
    $('time-scrub').value = 0;
    renderCharts(); renderCurrentMetrics();
  }
  state.isPlaying = true;
  state.playbackLast = 0;
  const button = $('play-timeline');
  if (button) { button.setAttribute('aria-pressed', 'true'); button.innerHTML = '<span class="play-glyph">Ⅱ</span> Pause trajectory'; }
  state.playbackRequest = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(playbackFrame)
    : setTimeout(() => playbackFrame(Date.now()), 40);
}

function renderGeneralInsight() {
  if (!Object.keys(state.curves).length) return;
  const stats = TOPOLOGIES.map(key => {
    const curve = state.curves[key];
    let peak = 0;
    for (let i = 1; i < curve.power.length; i++) if (curve.power[i] > curve.power[peak]) peak = i;
    return { key, peakPower: curve.power[peak], peakTime: curve.times[peak], finalEnergy: curve.energy[curve.energy.length - 1] };
  });
  const fastest = [...stats].sort((a, b) => b.peakPower - a.peakPower)[0];
  const fullest = [...stats].sort((a, b) => b.finalEnergy - a.finalEnergy)[0];
  const note = fastest.key === fullest.key
    ? `${TOPOLOGY_INFO[fastest.key].label} leads both peak average power and final stored energy at the current settings.`
    : `Trade-off detected: ${TOPOLOGY_INFO[fastest.key].label} has the highest peak average power, while ${TOPOLOGY_INFO[fullest.key].label} has the most stored energy at the final time.`;
  setMissionFeedback('Live finding · current settings', note,
    `Ppeak=${fmt(fastest.peakPower,3)} at t=${fmt(fastest.peakTime,2)} · Efinal,max=${fmt(fullest.finalEnergy,3)}.`);
}

function setMissionFeedback(title, body, metric = '') {
  const target = $('mission-feedback');
  if (!target) return;
  target.innerHTML = `<span class="feedback-symbol">✦</span><div><strong>${title}</strong><p>${body}${metric ? ` <span class="feedback-metric">${metric}</span>` : ''}</p></div>`;
}

function renderMissionOutcome(missionId) {
  const mission = MISSION_PRESETS[missionId];
  if (!mission || !Object.keys(state.curves).length) return;
  const curves = state.curves;
  if (missionId === 'coupling-off') {
    let gap = 0;
    for (const key of ['star', 'chain', 'all-to-all']) {
      curves[key].energy.forEach((value, index) => {
        gap = Math.max(gap, Math.abs(value - curves.parallel.energy[index]));
      });
    }
    setMissionFeedback(mission.title, mission.summary, `Max energy-curve gap vs parallel: ${gap.toExponential(2)}.`);
    return;
  }
  const stats = TOPOLOGIES.map(key => {
    const curve = curves[key];
    let peak = -Infinity, peakIndex = 0;
    for (let i = 1; i < curve.power.length; i++) if (curve.power[i] > peak) { peak = curve.power[i]; peakIndex = i; }
    return { key, peak, peakTime: curve.times[peakIndex], finalEnergy: curve.energy[curve.energy.length - 1], normDrift: Math.max(...curve.norms.map(v => Math.abs(v - 1))) };
  });
  if (missionId === 'power-vs-energy') {
    const fastest = [...stats].sort((a,b)=>b.peak-a.peak)[0];
    const mostStored = [...stats].sort((a,b)=>b.finalEnergy-a.finalEnergy)[0];
    const distinction = fastest.key === mostStored.key
      ? `In this setting, ${TOPOLOGY_INFO[fastest.key].label} leads both metrics.`
      : `Trade-off: ${TOPOLOGY_INFO[fastest.key].label} peaks in average power, while ${TOPOLOGY_INFO[mostStored.key].label} stores the most energy at T.`;
    setMissionFeedback(mission.title, `${mission.summary} ${distinction}`, `Peak power ${fmt(fastest.peak,3)} at t=${fmt(fastest.peakTime,2)}; final max E=${fmt(mostStored.finalEnergy,3)}.`);
  } else if (missionId === 'strong-coupling') {
    let maxGap = 0;
    curves.chain.energy.forEach((value,index)=> { maxGap=Math.max(maxGap,Math.abs(value-curves.parallel.energy[index])); });
    const curve = curves.chain;
    let peak = 0;
    for (let i=1;i<curve.power.length;i++) if(curve.power[i]>curve.power[peak]) peak=i;
    setMissionFeedback(mission.title, mission.summary, `Chain peak power ${fmt(curve.power[peak],3)} at t=${fmt(curve.times[peak],2)}; max energy gap vs parallel ${fmt(maxGap,3)}.`);
  } else {
    const drift = Math.max(...stats.map(s=>s.normDrift));
    const qubits = state.settings.nCells + (state.settings.topology === 'star' ? 1 : 0);
    setMissionFeedback(mission.title, mission.summary, `Selected graph uses ${qubits} state-vector qubits including hub if selected; maximum norm drift across four trajectories ${drift.toExponential(2)}.`);
  }
}

async function loadMission(missionId) {
  if (state.running) return;
  const mission = MISSION_PRESETS[missionId];
  if (!mission) return;
  stopTimelinePlayback();
  state.activeMission = missionId;
  state.settings.topology = mission.settings.topology;
  const mapping = { nCells: 'cells', omega: 'omega', drive: 'drive', coupling: 'coupling', tMax: 'horizon', steps: 'resolution' };
  for (const [key, id] of Object.entries(mapping)) $(id).value = mission.settings[key];
  $('time-scrub').value = mission.settings.scrub;
  document.querySelectorAll('.mission-card').forEach(card => card.classList.toggle('active', card.dataset.mission === missionId));
  updateSettingLabels();
  setMissionFeedback(mission.title, 'Running the classical reference for this guided experiment…');
  await runExperiment();
  renderMissionOutcome(missionId);
  const section = $('studio');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrubFromChartEvent(event) {
  const svg = event.target.closest('svg');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width) return;
  const viewX = (event.clientX - rect.left) / rect.width * 720;
  const fraction = clamp((viewX - 53) / (720 - 53 - 13), 0, 1);
  state.scrubIndex = Math.round(fraction * state.settings.steps);
  $('time-scrub').value = state.scrubIndex;
  renderCharts(); renderCurrentMetrics();
}

function pythonBridgeResult(value) {
  let result = value;
  if (result && typeof result.toJs === 'function') result = result.toJs();
  if (typeof result === 'string') return JSON.parse(result);
  if (result && typeof result === 'object') return result;
  throw new Error('Python bridge returned an unexpected result type.');
}
async function runQuantumValidation() {
  const button = $('run-quantum');
  if (button.disabled) return;
  button.disabled = true;
  const old = button.innerHTML;
  button.innerHTML = '<span class="loading-dots"><i></i><i></i><i></i></span> Preparing one batched job… <span class="button-tail">…</span>';
  $('quantum-result').classList.remove('hidden');
  $('quantum-result').innerHTML = '<strong>Quantum validation in progress</strong><br/>The selected topology is being Trotterized at each displayed time point; all circuits will be submitted in one backend job.';
  statusMessage('Preparing a batched Qiskit Trotter run for ' + TOPOLOGY_INFO[state.settings.topology].label + '…');
  try {
    const settings = getSettings();
    const backendObject = typeof backend !== 'undefined' ? backend : null;
    const response = await batteryBridge.run_selected_topology.callPromising(backendObject, JSON.stringify(settings));
    const result = pythonBridgeResult(response);
    if (!result || result.ok === false) throw new Error(result?.error || 'The Python bridge did not complete.');
    if (!Array.isArray(result.energy) || !Array.isArray(result.times)) throw new Error('The Python bridge did not return measured energy curves.');
    state.quantum = { topology: settings.topology, energy: result.energy, stderr: result.stderr || result.energy.map(()=>0), times: result.times, source: result.source || 'unknown' };
    renderCharts();
    const last = result.energy.length - 1;
    const exactLast = state.curves[settings.topology].energy[state.curves[settings.topology].energy.length - 1];
    const gap = Math.abs(result.energy[last] - exactLast);
    $('quantum-result').innerHTML = `<div class="qresult-head"><span class="result-dot"></span><strong>${result.source === 'selected Qollab backend' ? 'Backend run returned measurements' : 'Fallback simulation completed'}</strong></div><div class="qresult-grid"><div><small>MEASURED Eᵦ(T)</small><b>${fmt(result.energy[last],4)}</b><span>± ${fmt((result.stderr||[])[last]||0,4)} shot SE</span></div><div><small>JS CLASSICAL REFERENCE</small><b>${fmt(exactLast,4)}</b><span>absolute gap ${fmt(gap,4)}</span></div><div><small>CIRCUITS / JOB</small><b>${result.energy.length}</b><span>${result.shots || settings.shots} shots each</span></div></div><p>${result.source === 'selected Qollab backend' ? 'Measurements came from the simulator selected in Qollab. The gap includes Trotter approximation and finite-shot effects.' : 'This was a classical statevector sampling fallback, not a Qollab/QPU result. Check the console message for the backend issue.'}</p>`;
    statusMessage(result.source === 'selected Qollab backend' ? `Qiskit batch completed: ${result.energy.length} time-point circuits submitted in one job.` : 'Fallback completed; no Qollab backend measurements were obtained.', result.source === 'selected Qollab backend' ? 'success' : 'error');
  } catch (error) {
    const reason = String(error?.message || error).slice(0,260);
    $('quantum-result').innerHTML = `<strong>Optional quantum path did not complete.</strong><p>${reason}</p><p>The main interactive explainer and classical explainer remains available. Do not describe this attempt as a backend run.</p>`;
    statusMessage('Quantum validation unavailable: ' + reason, 'error');
  } finally {
    button.disabled = false; button.innerHTML = old;
  }
}
function attachEvents() {
  document.querySelectorAll('.topology-choice').forEach(button => button.addEventListener('click', () => {
    state.settings.topology = button.dataset.topology;
    updateSettingLabels(); updateTopologySelection(); renderTopologySvg($('hero-topology'), state.settings, true); renderTopologySvg($('main-topology'), state.settings, false);
    if (Object.keys(state.curves).length) { renderCharts(); renderCurrentMetrics(); renderRanking(); }
  }));
  for (const id of ['cells','omega','drive','coupling','horizon','resolution','shots']) {
    const control = $(id); if (!control) continue;
    control.addEventListener('input', updateSettingLabels);
    if (id !== 'shots') control.addEventListener('change', () => { stopTimelinePlayback(); state.activeMission = null; document.querySelectorAll('.mission-card').forEach(card => card.classList.remove('active')); runExperiment(); });
  }
  $('run-classical').addEventListener('click', () => { stopTimelinePlayback(); state.activeMission = null; document.querySelectorAll('.mission-card').forEach(card => card.classList.remove('active')); runExperiment(); });
  $('hero-run').addEventListener('click', () => { document.querySelector('#studio').scrollIntoView({ behavior:'smooth', block:'start' }); runExperiment(); });
  $('run-quantum').addEventListener('click', runQuantumValidation);
  $('time-scrub').addEventListener('input', () => {
    stopTimelinePlayback();
    state.scrubIndex = Number($('time-scrub').value);
    renderCharts(); renderCurrentMetrics();
  });
  $('chart-legend').addEventListener('click', event => {
    const button = event.target.closest('[data-visible]'); if (!button) return;
    const key = button.dataset.visible; state.visible[key] = !state.visible[key]; renderCharts();
  });
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { event.preventDefault(); target.scrollIntoView({ behavior:'smooth', block:'start' }); }
  }));
}
function init() {
  attachEvents(); updateSettingLabels();
  $('scrub-time-label')?.setAttribute('aria-live', 'polite');
  runExperiment({ initial: true });
}
init();
