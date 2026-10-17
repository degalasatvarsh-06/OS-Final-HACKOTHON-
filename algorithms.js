/**
 * Disk Scheduling Algorithms Engine
 * Implements FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK, and Smart-Adaptive OS Scheduling.
 */

const DiskAlgorithms = {
  /**
   * First-Come, First-Served (FCFS)
   */
  fcfs(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = null;

    requests.forEach((req, idx) => {
      const seek = Math.abs(req - current);
      const curDir = req > current ? 'right' : (req < current ? 'left' : lastDir || 'right');
      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;
      totalSeek += seek;
      seeks.push(seek);
      sequence.push(req);
      stepDetails.push({
        step: idx + 1,
        from: current,
        to: req,
        seek,
        direction: curDir,
        reason: `FCFS order (request #${idx + 1})`
      });
      current = req;
    });

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'FCFS',
      fullName: 'First-Come First-Served',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'None (Fair)',
      starvationPill: 'risk-low',
      stepDetails
    };
  },

  /**
   * Shortest Seek Time First (SSTF)
   */
  sstf(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    const pending = [...requests];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = null;
    let stepCount = 0;

    while (pending.length > 0) {
      stepCount++;
      let minDistance = Infinity;
      let minIdx = -1;

      // Find closest request to current head
      for (let i = 0; i < pending.length; i++) {
        const dist = Math.abs(pending[i] - current);
        if (dist < minDistance) {
          minDistance = dist;
          minIdx = i;
        }
      }

      const nextCyl = pending.splice(minIdx, 1)[0];
      const seek = minDistance;
      const curDir = nextCyl > current ? 'right' : (nextCyl < current ? 'left' : lastDir || 'right');
      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;

      totalSeek += seek;
      seeks.push(seek);
      sequence.push(nextCyl);
      stepDetails.push({
        step: stepCount,
        from: current,
        to: nextCyl,
        seek,
        direction: curDir,
        reason: `Shortest seek distance: ${seek} cylinders`
      });
      current = nextCyl;
    }

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'SSTF',
      fullName: 'Shortest Seek Time First',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'High (Outer tracks starve)',
      starvationPill: 'risk-high',
      stepDetails
    };
  },

  /**
   * SCAN (Elevator Algorithm)
   */
  scan(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = direction;

    const left = requests.filter(r => r < initialHead).sort((a, b) => b - a);
    const right = requests.filter(r => r >= initialHead).sort((a, b) => a - b);

    let visitQueue = [];

    if (direction === 'right') {
      visitQueue = [...right];
      if (left.length > 0) {
        // Must touch edge boundary (maxCylinders - 1) before reversing
        visitQueue.push(maxCylinders - 1);
        visitQueue = visitQueue.concat(left);
      }
    } else {
      visitQueue = [...left];
      if (right.length > 0) {
        // Must touch edge boundary 0 before reversing
        visitQueue.push(0);
        visitQueue = visitQueue.concat(right);
      }
    }

    visitQueue.forEach((target, idx) => {
      if (target === current) return;
      const seek = Math.abs(target - current);
      const curDir = target > current ? 'right' : 'left';
      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;
      totalSeek += seek;
      seeks.push(seek);
      sequence.push(target);

      const isBoundary = target === 0 || target === maxCylinders - 1;
      stepDetails.push({
        step: idx + 1,
        from: current,
        to: target,
        seek,
        direction: curDir,
        reason: isBoundary ? `Reached boundary (${target}) and inverted sweep` : `Sweeping in direction ${curDir}`
      });
      current = target;
    });

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'SCAN',
      fullName: 'SCAN (Elevator Algorithm)',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'Low (Bounded wait)',
      starvationPill: 'risk-low',
      stepDetails
    };
  },

  /**
   * C-SCAN (Circular SCAN)
   */
  cscan(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = direction;

    const left = requests.filter(r => r < initialHead).sort((a, b) => a - b);
    const right = requests.filter(r => r >= initialHead).sort((a, b) => a - b);

    let visitQueue = [];

    if (direction === 'right') {
      visitQueue = [...right];
      if (left.length > 0) {
        visitQueue.push(maxCylinders - 1);
        visitQueue.push(0); // Circular warp to start
        visitQueue = visitQueue.concat(left);
      }
    } else {
      const leftDesc = requests.filter(r => r <= initialHead).sort((a, b) => b - a);
      const rightDesc = requests.filter(r => r > initialHead).sort((a, b) => b - a);
      visitQueue = [...leftDesc];
      if (rightDesc.length > 0) {
        visitQueue.push(0);
        visitQueue.push(maxCylinders - 1);
        visitQueue = visitQueue.concat(rightDesc);
      }
    }

    visitQueue.forEach((target, idx) => {
      if (target === current) return;
      const seek = Math.abs(target - current);
      const curDir = target > current ? 'right' : 'left';
      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;
      totalSeek += seek;
      seeks.push(seek);
      sequence.push(target);

      const isWrap = (current === maxCylinders - 1 && target === 0) || (current === 0 && target === maxCylinders - 1);
      stepDetails.push({
        step: idx + 1,
        from: current,
        to: target,
        seek,
        direction: curDir,
        reason: isWrap ? `Circular reset sweep to ${target}` : `Servicing during forward pass`
      });
      current = target;
    });

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'C-SCAN',
      fullName: 'Circular SCAN',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'Very Low (Uniform wait)',
      starvationPill: 'risk-low',
      stepDetails
    };
  },

  /**
   * LOOK (Look Elevator)
   */
  look(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = direction;

    const left = requests.filter(r => r < initialHead).sort((a, b) => b - a);
    const right = requests.filter(r => r >= initialHead).sort((a, b) => a - b);

    let visitQueue = [];

    if (direction === 'right') {
      visitQueue = [...right, ...left];
    } else {
      visitQueue = [...left, ...right];
    }

    visitQueue.forEach((target, idx) => {
      if (target === current) return;
      const seek = Math.abs(target - current);
      const curDir = target > current ? 'right' : 'left';
      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;
      totalSeek += seek;
      seeks.push(seek);
      sequence.push(target);

      stepDetails.push({
        step: idx + 1,
        from: current,
        to: target,
        seek,
        direction: curDir,
        reason: `LOOK ahead pass to ${target}`
      });
      current = target;
    });

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'LOOK',
      fullName: 'LOOK Algorithm',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'Low (Fair turnaround)',
      starvationPill: 'risk-low',
      stepDetails
    };
  },

  /**
   * C-LOOK (Circular LOOK)
   */
  clook(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = direction;

    const left = requests.filter(r => r < initialHead).sort((a, b) => a - b);
    const right = requests.filter(r => r >= initialHead).sort((a, b) => a - b);

    let visitQueue = [];

    if (direction === 'right') {
      visitQueue = [...right, ...left];
    } else {
      const leftDesc = requests.filter(r => r <= initialHead).sort((a, b) => b - a);
      const rightDesc = requests.filter(r => r > initialHead).sort((a, b) => b - a);
      visitQueue = [...leftDesc, ...rightDesc];
    }

    visitQueue.forEach((target, idx) => {
      if (target === current) return;
      const seek = Math.abs(target - current);
      const curDir = target > current ? 'right' : 'left';
      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;
      totalSeek += seek;
      seeks.push(seek);
      sequence.push(target);

      const isJump = (direction === 'right' && target < current) || (direction === 'left' && target > current);
      stepDetails.push({
        step: idx + 1,
        from: current,
        to: target,
        seek,
        direction: curDir,
        reason: isJump ? `Direct jump to lowest requested cylinder ${target}` : `Servicing pending cylinder ${target}`
      });
      current = target;
    });

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'C-LOOK',
      fullName: 'Circular LOOK',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'Very Low (Uniform distribution)',
      starvationPill: 'risk-low',
      stepDetails
    };
  },

  /**
   * SMART-ADAPTIVE (Hybrid Heuristic / Deadline Scheduler)
   * Dynamically balances seek distance minimization with an aging penalty function to completely eliminate starvation.
   * Cost = SeekDistance - (AgeFactor * (WaitSteps)^1.6)
   */
  smart(initialHead, requests, maxCylinders, direction = 'right') {
    const sequence = [initialHead];
    const seeks = [];
    const stepDetails = [];
    let current = initialHead;
    let totalSeek = 0;
    let dirChanges = 0;
    let lastDir = direction;

    // Track wait steps for starvation prevention
    const pending = requests.map((cyl, idx) => ({
      cyl,
      initialIdx: idx,
      waitedSteps: 0,
      deadlineThreshold: 4 // Starvation threshold
    }));

    let step = 0;

    while (pending.length > 0) {
      step++;
      let bestCost = Infinity;
      let bestIdx = -1;
      let bestReason = '';

      // Check if any request is in critical starvation state
      const starvingCandidate = pending.find(p => p.waitedSteps >= p.deadlineThreshold);

      if (starvingCandidate) {
        // Prioritize preventing starvation
        bestIdx = pending.indexOf(starvingCandidate);
        const dist = Math.abs(pending[bestIdx].cyl - current);
        bestReason = `🚨 Starvation Guard: Request ${pending[bestIdx].cyl} waited ${pending[bestIdx].waitedSteps} cycles (Overridden priority)`;
      } else {
        // Evaluate dynamic cost function: Seek Distance - Aging Bonus - Direction Momentum
        for (let i = 0; i < pending.length; i++) {
          const item = pending[i];
          const dist = Math.abs(item.cyl - current);
          const movingSameDir = (item.cyl >= current && lastDir === 'right') || (item.cyl <= current && lastDir === 'left');
          const momentumBonus = movingSameDir ? 8 : 0;
          const agingPenalty = Math.pow(item.waitedSteps, 1.4) * 6;

          const cost = dist - momentumBonus - agingPenalty;

          if (cost < bestCost) {
            bestCost = cost;
            bestIdx = i;
            bestReason = `Optimal cost (${cost.toFixed(1)}): dist=${dist}, wait=${item.waitedSteps}, momentum=${momentumBonus}`;
          }
        }
      }

      const chosen = pending.splice(bestIdx, 1)[0];
      const seek = Math.abs(chosen.cyl - current);
      const curDir = chosen.cyl > current ? 'right' : (chosen.cyl < current ? 'left' : lastDir);

      if (lastDir && curDir !== lastDir) {
        dirChanges++;
      }
      lastDir = curDir;

      totalSeek += seek;
      seeks.push(seek);
      sequence.push(chosen.cyl);

      stepDetails.push({
        step,
        from: current,
        to: chosen.cyl,
        seek,
        direction: curDir,
        reason: bestReason
      });

      current = chosen.cyl;

      // Increment wait counter for all still-waiting requests
      pending.forEach(p => p.waitedSteps++);
    }

    const avgSeek = requests.length > 0 ? (totalSeek / requests.length).toFixed(2) : 0;

    return {
      name: 'SMART',
      fullName: 'Smart-Adaptive (SSTF + Starvation Guard)',
      sequence,
      seeks,
      totalSeek,
      avgSeek: parseFloat(avgSeek),
      directionChanges: dirChanges,
      starvationRisk: 'Zero (Active Age Throttling)',
      starvationPill: 'risk-low',
      stepDetails
    };
  },

  /**
   * Execute an algorithm by key
   */
  run(key, initialHead, requests, maxCylinders, direction = 'right') {
    switch (key.toUpperCase()) {
      case 'FCFS': return this.fcfs(initialHead, requests, maxCylinders, direction);
      case 'SSTF': return this.sstf(initialHead, requests, maxCylinders, direction);
      case 'SCAN': return this.scan(initialHead, requests, maxCylinders, direction);
      case 'CSCAN':
      case 'C-SCAN': return this.cscan(initialHead, requests, maxCylinders, direction);
      case 'LOOK': return this.look(initialHead, requests, maxCylinders, direction);
      case 'CLOOK':
      case 'C-LOOK': return this.clook(initialHead, requests, maxCylinders, direction);
      case 'SMART':
      default: return this.smart(initialHead, requests, maxCylinders, direction);
    }
  },

  /**
   * Run all algorithms simultaneously for benchmarking
   */
  benchmarkAll(initialHead, requests, maxCylinders, direction = 'right') {
    const algos = ['SMART', 'FCFS', 'SSTF', 'SCAN', 'CSCAN', 'LOOK', 'CLOOK'];
    const results = algos.map(key => this.run(key, initialHead, requests, maxCylinders, direction));
    
    // Sort by Total Head Movement ascending
    results.sort((a, b) => a.totalSeek - b.totalSeek);
    return results;
  }
};

if (typeof module !== 'undefined') {
  module.exports = DiskAlgorithms;
}
