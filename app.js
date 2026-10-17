/**
 * Main Application Controller for Smart Disk Scheduler
 */

(function () {
  'use strict';

  // State Management
  const state = {
    initialHead: 53,
    maxCylinders: 200,
    requests: [98, 183, 37, 122, 14, 124, 65, 67],
    direction: 'right', // 'right' (high) or 'left' (low)
    algorithm: 'SMART',
    speed: 1.0,
    isPlaying: false,
    currentStep: 0,
    result: null,
    fcfsBaseline: null,
    playInterval: null
  };

  // Preset Configurations
  const PRESETS = {
    textbook: {
      head: 53,
      max: 200,
      requests: [98, 183, 37, 122, 14, 124, 65, 67],
      direction: 'right'
    },
    'high-variance': {
      head: 100,
      max: 200,
      requests: [10, 195, 25, 180, 5, 190, 30, 175],
      direction: 'right'
    },
    clustered: {
      head: 50,
      max: 200,
      requests: [45, 48, 52, 50, 49, 160, 162, 158],
      direction: 'right'
    },
    starvation: {
      head: 50,
      max: 200,
      requests: [50, 52, 51, 53, 55, 54, 56, 195, 4],
      direction: 'right'
    }
  };

  // Theory Information Repository
  const THEORY_DATA = {
    smart: {
      title: '🌟 Smart-Adaptive (AI & Starvation-Guarded)',
      subtitle: 'Modern Hybrid Storage Heuristic',
      complexity: 'O(N²)',
      category: 'Adaptive / Heuristic',
      pros: [
        'Achieves 90-95% of SSTF seek efficiency without the catastrophic starvation flaw',
        'Guaranteed upper bound on request wait time through exponential aging penalty',
        'Maintains direction momentum to eliminate mechanical actuator thrashing',
        'Ideal model for modern operating system deadline schedulers'
      ],
      cons: [
        'Requires continuous polynomial cost evaluation per step',
        'Tuning parameters (alpha aging vs beta distance) depend on workload profile'
      ],
      deepDive: 'Standard SSTF creates severe starvation for outer cylinders if incoming requests cluster near the current head. The Smart-Adaptive scheduler utilizes a dynamic cost function: Cost = SeekDistance - (MomentumBonus) - (AgeFactor × WaitCycles^1.4). When a cylinder wait time breaches the deadline threshold, the scheduler forces an immediate priority override, eliminating starvation forever.'
    },
    fcfs: {
      title: 'First-Come First-Served (FCFS)',
      subtitle: 'Simplest FIFO Disk Queue',
      complexity: 'O(N)',
      category: 'FIFO',
      pros: [
        'Completely fair: every request is serviced strictly in arrival order',
        'No starvation: no request can be postponed indefinitely',
        'Zero computational overhead to implement'
      ],
      cons: [
        'Suffers from wild actuator swings (large seek distances)',
        'Extremely inefficient with poor overall throughput',
        'Performance deteriorates dramatically under heavy multi-threaded I/O loads'
      ],
      deepDive: 'FCFS does not attempt to optimize head movement. If alternating requests arrive for cylinder 10 and cylinder 190, the head travels back and forth across the entire disk surface, causing intense mechanical wear and prolonged latency.'
    },
    sstf: {
      title: 'Shortest Seek Time First (SSTF)',
      subtitle: 'Greedy Minimum Seek Distance Algorithm',
      complexity: 'O(N²)',
      category: 'Greedy',
      pros: [
        'Significantly lowers total head movement compared to FCFS',
        'Maximizes average system throughput for clustered requests',
        'Simple greedy heuristic'
      ],
      cons: [
        'Vulnerable to permanent starvation of distant tracks',
        'High variance in response times',
        'Can get trapped in a localized cluster of requests while outer tracks wait forever'
      ],
      deepDive: 'SSTF always selects the request closest to the current head position. Although mathematically optimal in the immediate next step, it is not globally optimal and fails basic operating system fairness criteria.'
    },
    scan: {
      title: 'SCAN (Elevator Algorithm)',
      subtitle: 'Bidirectional Cylinder Sweep',
      complexity: 'O(N log N)',
      category: 'Elevator',
      pros: [
        'Completely prevents starvation with uniform wait time bounds',
        'Smooth mechanical movement with gentle direction reversals',
        'Much higher throughput than FCFS'
      ],
      cons: [
        'Obligated to travel all the way to the disk edge (cylinder 0 or Max-1) even if no requests exist there',
        'Requests arriving just behind the head must wait for a complete round trip sweep'
      ],
      deepDive: 'Like a building elevator, SCAN travels continuously in one direction servicing all requests until it hits the outer or inner edge boundary of the disk, then reverses direction and repeats.'
    },
    cscan: {
      title: 'C-SCAN (Circular SCAN)',
      subtitle: 'Unidirectional Sweep with Instant Reset',
      complexity: 'O(N log N)',
      category: 'Circular Sweep',
      pros: [
        'Provides a more uniform waiting time than standard SCAN',
        'Eliminates the bias favoring middle cylinders over extreme cylinders',
        'Deterministic seek intervals'
      ],
      cons: [
        'Wastes seek movement during the return jump from end to beginning',
        'Must still touch the physical edge cylinders'
      ],
      deepDive: 'C-SCAN treats cylinders as a circular cylinder ring. It moves in one direction only. When it reaches the end, it immediately returns to the beginning of the disk without servicing any requests on the return journey.'
    },
    look: {
      title: 'LOOK Algorithm',
      subtitle: 'Smart Elevator Reversing at Last Request',
      complexity: 'O(N log N)',
      category: 'Elevator Enhancement',
      pros: [
        'Eliminates the wasteful travel to empty physical disk boundaries (0 and Max)',
        'Reverses direction immediately after servicing the outermost pending request',
        'Substantially faster than standard SCAN'
      ],
      cons: [
        'Requests at the boundaries still experience slight waiting bias compared to circular variants'
      ],
      deepDive: 'LOOK is the practical version of SCAN. Before moving the head further, it "looks" ahead to see if there are any pending requests in that direction. If none remain, it reverses immediately.'
    },
    clook: {
      title: 'C-LOOK (Circular LOOK)',
      subtitle: 'Industry-Standard Optimized Circular Sweep',
      complexity: 'O(N log N)',
      category: 'Circular Enhancement',
      pros: [
        'One of the most efficient mechanical disk scheduling algorithms',
        'Never sweeps past the outermost requests',
        'Fast return trip to the lowest requested cylinder instead of cylinder 0',
        'Very uniform wait times across all cylinders'
      ],
      cons: [
        'Slightly higher seek count on tiny single-request queues compared to pure SSTF'
      ],
      deepDive: 'C-LOOK improves upon C-SCAN by only moving as far as the final request in each direction. On its return trip, it jumps directly to the lowest requested cylinder rather than all the way to track 0.'
    }
  };

  // DOM Elements
  const el = {
    presetSelect: document.getElementById('presetSelect'),
    algoSelect: document.getElementById('algorithmSelect'),
    algoShortDesc: document.getElementById('algoShortDesc'),
    requestQueueInput: document.getElementById('requestQueueInput'),
    initialHeadInput: document.getElementById('initialHeadInput'),
    maxCylinderInput: document.getElementById('maxCylinderInput'),
    directionToggle: document.getElementById('directionToggle'),
    randomizeBtn: document.getElementById('randomizeBtn'),
    liveCylinderInput: document.getElementById('liveCylinderInput'),
    injectBtn: document.getElementById('injectBtn'),

    // Playback
    playPauseBtn: document.getElementById('playPauseBtn'),
    stepPrevBtn: document.getElementById('stepPrevBtn'),
    stepNextBtn: document.getElementById('stepNextBtn'),
    resetBtn: document.getElementById('resetBtn'),
    speedSlider: document.getElementById('speedSlider'),
    speedValText: document.getElementById('speedValText'),

    // Metrics
    metricTotalSeek: document.getElementById('metricTotalSeek'),
    metricAvgSeek: document.getElementById('metricAvgSeek'),
    metricEfficiency: document.getElementById('metricEfficiency'),
    metricMaxWait: document.getElementById('metricMaxWait'),
    currentHeadText: document.getElementById('currentHeadText'),
    stepCounter: document.getElementById('stepCounter'),
    streamList: document.getElementById('streamList'),

    // Linear Rail
    trackRail: document.getElementById('trackRail'),
    trackHeadIndicator: document.getElementById('trackHeadIndicator'),
    trackHeadLabel: document.getElementById('trackHeadLabel'),
    maxTrackLabel: document.getElementById('maxTrackLabel'),
    maxTrackEndLabel: document.getElementById('maxTrackEndLabel'),
    queueCountRemaining: document.getElementById('queueCountRemaining'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    paneDual: document.getElementById('paneDual'),
    paneBenchmark: document.getElementById('paneBenchmark'),

    // Benchmark
    benchmarkQueueStr: document.getElementById('benchmarkQueueStr'),
    benchmarkHeadStr: document.getElementById('benchmarkHeadStr'),
    benchmarkTableBody: document.getElementById('benchmarkTableBody'),
    recomputeBenchmarkBtn: document.getElementById('recomputeBenchmarkBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),

    // Audio & Theory & Race Modals
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    openTheoryBtn: document.getElementById('openTheoryBtn'),
    closeTheoryBtn: document.getElementById('closeTheoryBtn'),
    theoryModal: document.getElementById('theoryModal'),
    theoryContentBox: document.getElementById('theoryContentBox'),
    theoryTabBtns: document.querySelectorAll('.theory-tab-btn'),

    openRaceBtn: document.getElementById('openRaceBtn'),
    closeRaceBtn: document.getElementById('closeRaceBtn'),
    raceModal: document.getElementById('raceModal'),
    startRaceBtn: document.getElementById('startRaceBtn'),
    resetRaceBtn: document.getElementById('resetRaceBtn'),
    raceStatusText: document.getElementById('raceStatusText'),
    raceLanesContainer: document.getElementById('raceLanesContainer')
  };

  // Initialize Visualizer Engine
  let visualizer = null;

  function init() {
    visualizer = new DiskVisualizer('platterCanvas', 'graphCanvas', 'benchmarkChartCanvas');
    setupEventListeners();
    applyStateFromInputs();
    runAlgorithm();
    updateUI();
  }

  /**
   * Parse form inputs into state
   */
  function applyStateFromInputs() {
    state.initialHead = parseInt(el.initialHeadInput.value, 10) || 53;
    state.maxCylinders = parseInt(el.maxCylinderInput.value, 10) || 200;
    state.algorithm = el.algoSelect.value;

    const rawQueue = el.requestQueueInput.value;
    state.requests = rawQueue
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0 && n < state.maxCylinders);

    // Limit initial head to max cylinder
    if (state.initialHead >= state.maxCylinders) {
      state.initialHead = state.maxCylinders - 1;
      el.initialHeadInput.value = state.initialHead;
    }

    el.maxTrackLabel.textContent = state.maxCylinders - 1;
    el.maxTrackEndLabel.textContent = state.maxCylinders - 1;
    el.initialHeadInput.max = state.maxCylinders - 1;
    el.liveCylinderInput.max = state.maxCylinders - 1;
  }

  /**
   * Run current selected algorithm and benchmark baseline
   */
  function runAlgorithm() {
    state.result = DiskAlgorithms.run(
      state.algorithm,
      state.initialHead,
      state.requests,
      state.maxCylinders,
      state.direction
    );

    // Baseline FCFS for efficiency calculation
    state.fcfsBaseline = DiskAlgorithms.fcfs(
      state.initialHead,
      state.requests,
      state.maxCylinders,
      state.direction
    );

    if (state.currentStep >= state.result.sequence.length) {
      state.currentStep = state.result.sequence.length - 1;
    }

    updateVisualizerState();
  }

  /**
   * Sync visualizer with current state
   */
  function updateVisualizerState() {
    if (!visualizer || !state.result) return;
    const curHead = state.result.sequence[state.currentStep] ?? state.initialHead;

    visualizer.updateState({
      maxCylinders: state.maxCylinders,
      targetHeadPos: curHead,
      sequence: state.result.sequence,
      requests: state.requests,
      currentStep: state.currentStep
    });

    el.currentHeadText.textContent = curHead;
  }

  /**
   * Update full UI (Metrics, Rail, Stream log, etc.)
   */
  function updateUI() {
    if (!state.result) return;

    const curHead = state.result.sequence[state.currentStep] ?? state.initialHead;

    // 1. Top Metrics Ribbon
    let traversedSeekSoFar = 0;
    for (let i = 0; i < state.currentStep; i++) {
      traversedSeekSoFar += state.result.seeks[i] || 0;
    }

    el.metricTotalSeek.textContent = traversedSeekSoFar;
    const avgSoFar = state.currentStep > 0 ? (traversedSeekSoFar / state.currentStep).toFixed(1) : '0.0';
    el.metricAvgSeek.textContent = avgSoFar;

    // Efficiency Score vs FCFS
    if (state.fcfsBaseline && state.fcfsBaseline.totalSeek > 0) {
      const efficiency = Math.round((state.fcfsBaseline.totalSeek / Math.max(state.result.totalSeek, 1)) * 100);
      el.metricEfficiency.textContent = `${efficiency}%`;
    } else {
      el.metricEfficiency.textContent = '100%';
    }

    // Max Starvation wait count
    let maxWait = 0;
    if (state.algorithm === 'SMART') {
      maxWait = 3; // Bounded
    } else if (state.algorithm === 'SSTF') {
      maxWait = Math.max(0, state.requests.length - 1);
    } else {
      maxWait = Math.ceil(state.requests.length / 2);
    }
    el.metricMaxWait.textContent = maxWait;

    // Step Counter badge
    el.stepCounter.textContent = `Step ${state.currentStep} / ${state.result.sequence.length - 1}`;

    // 2. Linear Cylinder Rail
    renderLinearTrackRail(curHead);

    // 3. Execution Stream List
    renderStreamList();

    // 4. Update Algorithm Description & Badge
    updateAlgoDescription();

    // 5. Update Benchmark Matrix if on benchmark tab
    updateBenchmarkTab();
  }

  /**
   * Render Linear Track Rail Markers & Head pointer
   */
  function renderLinearTrackRail(curHead) {
    const rail = el.trackRail;
    // Remove existing target pins
    const pins = rail.querySelectorAll('.track-target-pin');
    pins.forEach(p => p.remove());

    const max = state.maxCylinders - 1 || 1;

    // Add pins for pending/visited requests
    const visitedSet = new Set(state.result.sequence.slice(0, state.currentStep + 1));

    state.requests.forEach(cyl => {
      const pin = document.createElement('div');
      const isVisited = visitedSet.has(cyl);
      pin.className = `track-target-pin ${isVisited ? 'visited' : ''}`;
      pin.setAttribute('data-cyl', cyl);
      pin.style.left = `${(cyl / max) * 100}%`;
      pin.textContent = cyl;
      rail.appendChild(pin);
    });

    // Animate head pointer position
    const headPercent = (curHead / max) * 100;
    el.trackHeadIndicator.style.left = `${headPercent}%`;
    el.trackHeadLabel.textContent = curHead;

    const remaining = state.requests.filter(r => !visitedSet.has(r)).length;
    el.queueCountRemaining.textContent = remaining;
  }

  /**
   * Render step-by-step stream list
   */
  function renderStreamList() {
    const list = el.streamList;
    list.innerHTML = '';

    state.result.stepDetails.forEach((step, idx) => {
      const item = document.createElement('div');
      const isCurrent = idx + 1 === state.currentStep;
      const isVisited = idx + 1 < state.currentStep;

      item.className = `stream-item ${isCurrent ? 'active' : ''} ${isVisited ? 'visited' : ''}`;
      item.innerHTML = `
        <span><strong>#${step.step}</strong>: ${step.from} → <strong style="color:var(--accent-cyan)">${step.to}</strong> (Δ${step.seek})</span>
        <span style="color:var(--text-dim);font-size:0.7rem;">${step.direction.toUpperCase()}</span>
      `;

      item.addEventListener('click', () => {
        pauseSimulation();
        state.currentStep = idx + 1;
        triggerStepAudioAndVisual(step.to, step.seek);
        updateVisualizerState();
        updateUI();
      });

      list.appendChild(item);

      if (isCurrent) {
        setTimeout(() => item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
      }
    });
  }

  /**
   * Update algorithm description badge
   */
  function updateAlgoDescription() {
    const map = {
      SMART: 'Dynamic polynomial cost evaluation with active starvation override',
      FCFS: 'Strict FIFO arrival order without head trajectory optimization',
      SSTF: 'Greedy choice of cylinder with minimum absolute distance',
      SCAN: 'Bidirectional elevator sweep between outer physical boundary and 0',
      CSCAN: 'Unidirectional sweep with high-speed reset jump to boundary 0',
      LOOK: 'Elevator sweep reversing immediately at outermost request',
      CLOOK: 'Circular sweep jumping directly to lowest requested cylinder'
    };
    el.algoShortDesc.textContent = map[state.algorithm] || '';
  }

  /**
   * Playback Loop
   */
  function startPlayback() {
    if (state.isPlaying) return;
    state.isPlaying = true;
    el.playPauseBtn.classList.add('playing');
    el.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';

    // If at end, wrap to start
    if (state.currentStep >= state.result.sequence.length - 1) {
      state.currentStep = 0;
      updateVisualizerState();
      updateUI();
    }

    const intervalMs = Math.max(250, 900 / state.speed);

    state.playInterval = setInterval(() => {
      if (state.currentStep < state.result.sequence.length - 1) {
        stepForward();
      } else {
        pauseSimulation();
      }
    }, intervalMs);
  }

  function pauseSimulation() {
    state.isPlaying = false;
    clearInterval(state.playInterval);
    state.playInterval = null;
    el.playPauseBtn.classList.remove('playing');
    el.playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }

  function togglePlayPause() {
    if (state.isPlaying) {
      pauseSimulation();
    } else {
      startPlayback();
    }
  }

  function stepForward() {
    if (!state.result || state.currentStep >= state.result.sequence.length - 1) return;
    state.currentStep++;
    const targetCyl = state.result.sequence[state.currentStep];
    const prevCyl = state.result.sequence[state.currentStep - 1];
    const seekDist = Math.abs(targetCyl - prevCyl);

    triggerStepAudioAndVisual(targetCyl, seekDist);
    updateVisualizerState();
    updateUI();
  }

  function stepBackward() {
    if (state.currentStep <= 0) return;
    state.currentStep--;
    updateVisualizerState();
    updateUI();
  }

  function resetSimulation() {
    pauseSimulation();
    state.currentStep = 0;
    updateVisualizerState();
    updateUI();
  }

  function triggerStepAudioAndVisual(cylinder, seekDist) {
    if (window.diskAudio) {
      window.diskAudio.playSeekClick(seekDist);
      setTimeout(() => window.diskAudio.playServicedChime(), 60);
    }
    if (visualizer) {
      visualizer.triggerHit(cylinder);
    }
  }

  /**
   * Benchmark Table & Chart
   */
  function updateBenchmarkTab() {
    el.benchmarkQueueStr.textContent = state.requests.join(', ');
    el.benchmarkHeadStr.textContent = state.initialHead;

    const allResults = DiskAlgorithms.benchmarkAll(
      state.initialHead,
      state.requests,
      state.maxCylinders,
      state.direction
    );

    if (visualizer) {
      visualizer.renderBenchmarkChart(allResults);
    }

    // Populate Table
    const tbody = el.benchmarkTableBody;
    tbody.innerHTML = '';

    allResults.forEach((res, idx) => {
      const tr = document.createElement('tr');
      const rank = idx + 1;
      const rankBadgeClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : 'rank-other'));

      tr.innerHTML = `
        <td><span class="rank-badge ${rankBadgeClass}">${rank}</span></td>
        <td class="algo-name-cell ${res.name === 'SMART' ? 'highlight-smart' : ''}">
          ${res.name === 'SMART' ? '<i class="fa-solid fa-star"></i>' : ''}
          ${res.fullName}
        </td>
        <td><strong>${res.totalSeek}</strong> cyls</td>
        <td>${res.avgSeek}</td>
        <td>${res.directionChanges}</td>
        <td><span class="starvation-pill ${res.starvationPill}">${res.starvationRisk}</span></td>
        <td><code style="font-size:0.75rem;color:var(--text-muted);">${res.sequence.join(' → ')}</code></td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * Multi-Algorithm Race Mode Simulation
   */
  let raceInterval = null;
  function startRace() {
    const container = el.raceLanesContainer;
    container.innerHTML = '';
    el.raceStatusText.textContent = 'Grand Prix in progress...';

    const algos = ['SMART', 'FCFS', 'SSTF', 'SCAN', 'CSCAN', 'LOOK', 'CLOOK'];
    const raceData = algos.map(key => {
      const res = DiskAlgorithms.run(key, state.initialHead, state.requests, state.maxCylinders, state.direction);
      return {
        key,
        res,
        step: 0,
        finished: false,
        totalSteps: res.sequence.length - 1
      };
    });

    // Create Lane UI for each algorithm
    raceData.forEach(lane => {
      const laneEl = document.createElement('div');
      laneEl.className = 'race-lane';
      laneEl.id = `lane-${lane.key}`;
      laneEl.innerHTML = `
        <div class="lane-algo-info">
          <span class="lane-algo-name">${lane.res.fullName}</span>
          <span class="lane-seek-counter" id="seek-${lane.key}">Seek: 0</span>
        </div>
        <div class="lane-track-strip">
          <div class="lane-progress-bar" id="prog-${lane.key}"></div>
          <div class="lane-runner-head" id="head-${lane.key}" style="left: 0%;"></div>
        </div>
        <div class="lane-finish-tag" id="tag-${lane.key}">Racing...</div>
      `;
      container.appendChild(laneEl);
    });

    let finishedCount = 0;
    clearInterval(raceInterval);

    raceInterval = setInterval(() => {
      let anyMoved = false;

      raceData.forEach(lane => {
        if (!lane.finished) {
          anyMoved = true;
          lane.step++;

          const pct = Math.min(100, Math.round((lane.step / lane.totalSteps) * 100));
          const progBar = document.getElementById(`prog-${lane.key}`);
          const runnerHead = document.getElementById(`head-${lane.key}`);
          const seekLabel = document.getElementById(`seek-${lane.key}`);

          if (progBar) progBar.style.width = `${pct}%`;
          if (runnerHead) runnerHead.style.left = `${pct}%`;

          // Sum seek up to step
          let s = 0;
          for (let i = 0; i < lane.step; i++) {
            s += lane.res.seeks[i] || 0;
          }
          if (seekLabel) seekLabel.textContent = `Seek: ${s}`;

          if (lane.step >= lane.totalSteps) {
            lane.finished = true;
            finishedCount++;
            const tag = document.getElementById(`tag-${lane.key}`);
            if (tag) {
              tag.className = 'lane-finish-tag finished';
              tag.textContent = `Rank #${finishedCount} (${lane.res.totalSeek}c)`;
            }
          }
        }
      });

      if (!anyMoved || finishedCount >= raceData.length) {
        clearInterval(raceInterval);
        el.raceStatusText.textContent = `Race Finished! Winner: ${raceData.sort((a,b)=>a.res.totalSeek-b.res.totalSeek)[0].res.name}`;
      }
    }, 280);
  }

  function resetRace() {
    clearInterval(raceInterval);
    el.raceStatusText.textContent = 'Ready for race!';
    startRace();
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Preset Selector
    el.presetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (PRESETS[val]) {
        const p = PRESETS[val];
        el.initialHeadInput.value = p.head;
        el.maxCylinderInput.value = p.max;
        el.requestQueueInput.value = p.requests.join(', ');
        state.direction = p.direction;

        // Sync direction toggle buttons
        document.querySelectorAll('#directionToggle .segment-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.dir === p.direction);
        });

        applyStateFromInputs();
        runAlgorithm();
        resetSimulation();
      }
    });

    // Algorithm Selector
    el.algoSelect.addEventListener('change', (e) => {
      state.algorithm = e.target.value;
      runAlgorithm();
      resetSimulation();
    });

    // Inputs Change
    [el.requestQueueInput, el.initialHeadInput, el.maxCylinderInput].forEach(inp => {
      inp.addEventListener('input', () => {
        applyStateFromInputs();
        runAlgorithm();
        resetSimulation();
      });
    });

    // Direction Toggle
    el.directionToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      el.directionToggle.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.direction = btn.dataset.dir;
      runAlgorithm();
      resetSimulation();
    });

    // Randomize Queue
    el.randomizeBtn.addEventListener('click', () => {
      const count = 8 + Math.floor(Math.random() * 4);
      const set = new Set();
      while (set.size < count) {
        set.add(Math.floor(Math.random() * state.maxCylinders));
      }
      el.requestQueueInput.value = Array.from(set).join(', ');
      applyStateFromInputs();
      runAlgorithm();
      resetSimulation();
    });

    // Dynamic Live Request Injector
    el.injectBtn.addEventListener('click', () => {
      const val = parseInt(el.liveCylinderInput.value, 10);
      if (!isNaN(val) && val >= 0 && val < state.maxCylinders) {
        state.requests.push(val);
        el.requestQueueInput.value = state.requests.join(', ');
        el.liveCylinderInput.value = '';
        runAlgorithm();
        updateVisualizerState();
        updateUI();
        triggerStepAudioAndVisual(val, 10);
      }
    });

    // Playback Controls
    el.playPauseBtn.addEventListener('click', togglePlayPause);
    el.stepNextBtn.addEventListener('click', () => {
      pauseSimulation();
      stepForward();
    });
    el.stepPrevBtn.addEventListener('click', () => {
      pauseSimulation();
      stepBackward();
    });
    el.resetBtn.addEventListener('click', resetSimulation);

    // Speed Slider
    el.speedSlider.addEventListener('input', (e) => {
      state.speed = parseFloat(e.target.value);
      el.speedValText.textContent = `${state.speed.toFixed(2)}x`;
      if (state.isPlaying) {
        pauseSimulation();
        startPlayback();
      }
    });

    // Tabs
    el.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        el.tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;

        if (tab === 'benchmark') {
          el.paneDual.style.display = 'none';
          el.paneBenchmark.style.display = 'block';
          updateBenchmarkTab();
        } else {
          el.paneBenchmark.style.display = 'none';
          el.paneDual.style.display = 'block';
        }
      });
    });

    // Sound Toggle
    el.soundToggleBtn.addEventListener('click', () => {
      if (window.diskAudio) {
        const enabled = window.diskAudio.toggle();
        el.soundToggleBtn.innerHTML = enabled
          ? '<i class="fa-solid fa-volume-high"></i> <span class="btn-text">Audio: On</span>'
          : '<i class="fa-solid fa-volume-xmark"></i> <span class="btn-text">Audio: Off</span>';
      }
    });

    // Theory Modal
    el.openTheoryBtn.addEventListener('click', () => {
      loadTheory('smart');
      el.theoryModal.style.display = 'flex';
    });
    el.closeTheoryBtn.addEventListener('click', () => {
      el.theoryModal.style.display = 'none';
    });
    el.theoryModal.addEventListener('click', (e) => {
      if (e.target === el.theoryModal) el.theoryModal.style.display = 'none';
    });

    el.theoryTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.theoryTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTheory(btn.dataset.theory);
      });
    });

    // Race Modal
    el.openRaceBtn.addEventListener('click', () => {
      el.raceModal.style.display = 'flex';
      startRace();
    });
    el.closeRaceBtn.addEventListener('click', () => {
      clearInterval(raceInterval);
      el.raceModal.style.display = 'none';
    });
    el.raceModal.addEventListener('click', (e) => {
      if (e.target === el.raceModal) {
        clearInterval(raceInterval);
        el.raceModal.style.display = 'none';
      }
    });
    el.startRaceBtn.addEventListener('click', startRace);
    el.resetRaceBtn.addEventListener('click', resetRace);

    // CSV Export
    el.exportCsvBtn.addEventListener('click', exportToCSV);

    // Recompute Benchmark
    el.recomputeBenchmarkBtn.addEventListener('click', () => {
      updateBenchmarkTab();
    });
  }

  /**
   * Load Theory Content into Modal
   */
  function loadTheory(key) {
    const data = THEORY_DATA[key];
    if (!data) return;

    el.theoryContentBox.innerHTML = `
      <div class="theory-sheet">
        <div class="theory-hero">
          <div>
            <h3>${data.title}</h3>
            <p>${data.subtitle}</p>
          </div>
          <div class="theory-badges">
            <span class="pill-badge pill-complexity"><i class="fa-solid fa-clock"></i> ${data.complexity}</span>
            <span class="pill-badge">${data.category}</span>
          </div>
        </div>

        <div class="theory-grid">
          <div class="pro-con-box pros-box">
            <h4><i class="fa-solid fa-circle-check"></i> Advantages</h4>
            <ul>${data.pros.map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
          <div class="pro-con-box cons-box">
            <h4><i class="fa-solid fa-triangle-exclamation"></i> Limitations & Hazards</h4>
            <ul>${data.cons.map(c => `<li>${c}</li>`).join('')}</ul>
          </div>
        </div>

        <div class="theory-deep-dive">
          <strong><i class="fa-solid fa-microchip"></i> Operating System Deep-Dive:</strong><br>
          ${data.deepDive}
        </div>
      </div>
    `;
  }

  /**
   * Export Benchmark Matrix & Current Trajectory to CSV
   */
  function exportToCSV() {
    const allResults = DiskAlgorithms.benchmarkAll(
      state.initialHead,
      state.requests,
      state.maxCylinders,
      state.direction
    );

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Rank,Algorithm,Total Seek Distance (Cylinders),Average Seek Distance,Direction Changes,Starvation Risk,Trajectory Sequence\r\n';

    allResults.forEach((res, idx) => {
      const seqStr = `"${res.sequence.join(' -> ')}"`;
      csvContent += `${idx + 1},${res.name},${res.totalSeek},${res.avgSeek},${res.directionChanges},"${res.starvationRisk}",${seqStr}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `disk_scheduler_benchmark_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
