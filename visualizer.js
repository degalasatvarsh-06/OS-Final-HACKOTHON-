/**
 * Disk Visualizer Canvas Engine
 * Handles 60FPS dual-view rendering:
 * 1. Rotary Platter & Actuator Voice Coil Arm with realistic physics
 * 2. Seek Trajectory Cylinder Time Graph
 * 3. Benchmark Comparison Chart
 */

class DiskVisualizer {
  constructor(platterCanvasId, graphCanvasId, benchmarkCanvasId) {
    this.platterCanvas = document.getElementById(platterCanvasId);
    this.graphCanvas = document.getElementById(graphCanvasId);
    this.benchmarkCanvas = document.getElementById(benchmarkCanvasId);

    this.platterCtx = this.platterCanvas ? this.platterCanvas.getContext('2d') : null;
    this.graphCtx = this.graphCanvas ? this.graphCanvas.getContext('2d') : null;
    this.benchmarkCtx = this.benchmarkCanvas ? this.benchmarkCanvas.getContext('2d') : null;

    // Simulation display state
    this.maxCylinders = 200;
    this.currentHeadPos = 53;
    this.targetHeadPos = 53;
    this.displayHeadPos = 53; // Smooth interpolated position

    this.sequence = [53];
    this.requests = [];
    this.currentStep = 0; // Current step index in sequence

    // Platter animation state
    this.diskRotation = 0;
    this.rippleEffects = []; // Visual ripples on cylinder hits

    this.initResize();
    this.startLoop();
  }

  initResize() {
    // High DPI Canvas Scaling
    const setupDpi = (canvas, ctx) => {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = (rect.width || 600) * dpr;
      canvas.height = (rect.height || 420) * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', () => {
      setupDpi(this.platterCanvas, this.platterCtx);
      setupDpi(this.graphCanvas, this.graphCtx);
      this.render();
    });

    setupDpi(this.platterCanvas, this.platterCtx);
    setupDpi(this.graphCanvas, this.graphCtx);
  }

  updateState({ maxCylinders, currentHeadPos, targetHeadPos, sequence, requests, currentStep }) {
    if (maxCylinders !== undefined) this.maxCylinders = maxCylinders;
    if (targetHeadPos !== undefined) this.targetHeadPos = targetHeadPos;
    if (sequence !== undefined) this.sequence = sequence;
    if (requests !== undefined) this.requests = requests;
    if (currentStep !== undefined) this.currentStep = currentStep;
  }

  triggerHit(cylinder) {
    this.rippleEffects.push({
      cylinder,
      radius: 0,
      alpha: 1.0
    });
  }

  startLoop() {
    const loop = () => {
      // Smooth interpolation for head position
      const diff = this.targetHeadPos - this.displayHeadPos;
      if (Math.abs(diff) > 0.05) {
        this.displayHeadPos += diff * 0.12;
      } else {
        this.displayHeadPos = this.targetHeadPos;
      }

      // Continuous disk rotation
      this.diskRotation += 0.04;
      if (this.diskRotation >= Math.PI * 2) {
        this.diskRotation = 0;
      }

      this.renderPlatter();
      this.renderGraph();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render() {
    this.renderPlatter();
    this.renderGraph();
  }

  /**
   * 1. RENDER ROTARY PLATTER & ACTUATOR ARM
   */
  renderPlatter() {
    if (!this.platterCtx) return;
    const ctx = this.platterCtx;
    const width = this.platterCanvas.getBoundingClientRect().width || 600;
    const height = this.platterCanvas.getBoundingClientRect().height || 420;

    ctx.clearRect(0, 0, width, height);

    // Center of circular platter
    const centerX = width * 0.44;
    const centerY = height * 0.5;
    const outerRadius = Math.min(width, height) * 0.44;
    const innerRadius = outerRadius * 0.28;

    // Platter base shadow & chassis outline
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = '#060a12';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // Metallic Platter Disk Gradient with spinning texture
    const platterGrad = ctx.createRadialGradient(
      centerX - 20, centerY - 20, innerRadius,
      centerX, centerY, outerRadius
    );
    platterGrad.addColorStop(0, '#1a2234');
    platterGrad.addColorStop(0.3, '#101726');
    platterGrad.addColorStop(0.7, '#18243b');
    platterGrad.addColorStop(1, '#0e1524');

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = platterGrad;
    ctx.fill();

    // Spinning reflection sheen
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.diskRotation);
    const sheenGrad = ctx.createConicGradient(0, 0, 0);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    sheenGrad.addColorStop(0.25, 'rgba(0, 242, 254, 0.06)');
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
    sheenGrad.addColorStop(0.75, 'rgba(139, 92, 246, 0.06)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Concentric Cylinder Track Rings
    const numRings = 8;
    for (let i = 1; i <= numRings; i++) {
      const r = innerRadius + ((outerRadius - innerRadius) / (numRings + 1)) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Helper: Map cylinder index to platter radius
    const cylToRadius = (cyl) => {
      const frac = Math.max(0, Math.min(1, cyl / (this.maxCylinders - 1 || 1)));
      // Cylinder 0 is outer track, max is inner track (standard HDD architecture)
      return outerRadius - frac * (outerRadius - innerRadius - 12);
    };

    // Draw Pending Request Cylinder Rings
    this.requests.forEach((reqCyl) => {
      const isVisited = this.sequence.slice(0, this.currentStep + 1).includes(reqCyl);
      const r = cylToRadius(reqCyl);

      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      if (isVisited) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw Hit Ripples
    for (let i = this.rippleEffects.length - 1; i >= 0; i--) {
      const rip = this.rippleEffects[i];
      rip.radius += 1.5;
      rip.alpha -= 0.035;

      const baseR = cylToRadius(rip.cylinder);
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 242, 254, ${Math.max(0, rip.alpha)})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      if (rip.alpha <= 0) {
        this.rippleEffects.splice(i, 1);
      }
    }

    // Active Cylinder Ring
    const activeRadius = cylToRadius(this.displayHeadPos);
    ctx.beginPath();
    ctx.arc(centerX, centerY, activeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center Spindle Hub
    const hubGrad = ctx.createRadialGradient(
      centerX - 5, centerY - 5, 2,
      centerX, centerY, innerRadius * 0.95
    );
    hubGrad.addColorStop(0, '#475569');
    hubGrad.addColorStop(0.7, '#1e293b');
    hubGrad.addColorStop(1, '#0f172a');

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spindle screws
    for (let a = 0; a < 3; a++) {
      const angle = (a * Math.PI * 2) / 3 + this.diskRotation;
      const sx = centerX + Math.cos(angle) * (innerRadius * 0.5);
      const sy = centerY + Math.sin(angle) * (innerRadius * 0.5);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
    }

    // ----------------------------------------------------
    // Actuator Voice Coil Arm Assembly
    // Pivot positioned at top-right or right edge
    // ----------------------------------------------------
    const pivotX = width * 0.88;
    const pivotY = height * 0.28;

    // Calculate arm angle such that head reaches (centerX, centerY - activeRadius) or an arc
    // Arm tip targets the active track along a curved arc
    const targetX = centerX + Math.cos(Math.PI * 0.25) * activeRadius;
    const targetY = centerY - Math.sin(Math.PI * 0.25) * activeRadius;

    // Update Arm Angle display badge in UI
    const armAngleDeg = Math.round(Math.atan2(targetY - pivotY, targetX - pivotX) * (180 / Math.PI));
    const armBadge = document.getElementById('armAngleBadge');
    if (armBadge) armBadge.textContent = `Arm Angle: ${armAngleDeg}°`;

    // Voice Coil Magnet Housing at Pivot
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pivot Bearing
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Metallic Actuator Arm Body
    ctx.beginPath();
    const armAngle = Math.atan2(targetY - pivotY, targetX - pivotX);
    const perpAngle = armAngle + Math.PI / 2;

    const baseWidth = 14;
    const tipWidth = 4;

    ctx.moveTo(pivotX + Math.cos(perpAngle) * baseWidth, pivotY + Math.sin(perpAngle) * baseWidth);
    ctx.lineTo(targetX + Math.cos(perpAngle) * tipWidth, targetY + Math.sin(perpAngle) * tipWidth);
    ctx.lineTo(targetX - Math.cos(perpAngle) * tipWidth, targetY - Math.sin(perpAngle) * tipWidth);
    ctx.lineTo(pivotX - Math.cos(perpAngle) * baseWidth, pivotY - Math.sin(perpAngle) * baseWidth);
    ctx.closePath();

    const armGrad = ctx.createLinearGradient(pivotX, pivotY, targetX, targetY);
    armGrad.addColorStop(0, '#94a3b8');
    armGrad.addColorStop(0.5, '#64748b');
    armGrad.addColorStop(1, '#cbd5e1');

    ctx.fillStyle = armGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Read/Write Head Slider
    ctx.beginPath();
    ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /**
   * 2. RENDER CYLINDER TRAJECTORY GRAPH OVER TIME (STEPS)
   */
  renderGraph() {
    if (!this.graphCtx) return;
    const ctx = this.graphCtx;
    const width = this.graphCanvas.getBoundingClientRect().width || 600;
    const height = this.graphCanvas.getBoundingClientRect().height || 420;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 35, right: 35, bottom: 45, left: 55 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const maxSteps = Math.max(this.sequence.length - 1, 1);

    // Helpers to convert data to canvas coordinates
    const getX = (step) => padding.left + (step / maxSteps) * plotW;
    const getY = (cyl) => padding.top + plotH - (cyl / (this.maxCylinders - 1 || 1)) * plotH;

    // Draw Grid Lines & Y-Axis Cylinder Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const cylVal = Math.round(frac * (this.maxCylinders - 1));
      const y = padding.top + plotH - frac * plotH;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(cylVal, padding.left - 10, y);
    }

    // Draw X-Axis Step Labels
    const xStepInterval = Math.max(1, Math.ceil(maxSteps / 8));
    for (let s = 0; s <= maxSteps; s += xStepInterval) {
      const x = getX(s);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`S${s}`, x, height - padding.bottom + 8);
    }

    // Trajectory Polyline
    if (this.sequence.length > 1) {
      // 1. Pending path (faint dashed)
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
      ctx.lineWidth = 2;
      ctx.moveTo(getX(0), getY(this.sequence[0]));
      for (let s = 1; s < this.sequence.length; s++) {
        ctx.lineTo(getX(s), getY(this.sequence[s]));
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Completed / Current Path (vibrant glowing cyan line)
      if (this.currentStep > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0, 242, 254, 0.6)';
        ctx.shadowBlur = 10;
        ctx.moveTo(getX(0), getY(this.sequence[0]));

        for (let s = 1; s <= this.currentStep; s++) {
          ctx.lineTo(getX(s), getY(this.sequence[s]));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw seek distance labels along completed lines
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#a7f3d0';
        ctx.textAlign = 'center';
        for (let s = 1; s <= this.currentStep; s++) {
          const prevX = getX(s - 1);
          const prevY = getY(this.sequence[s - 1]);
          const curX = getX(s);
          const curY = getY(this.sequence[s]);
          const midX = (prevX + curX) / 2;
          const midY = (prevY + curY) / 2;

          const seekDist = Math.abs(this.sequence[s] - this.sequence[s - 1]);
          ctx.fillText(`Δ${seekDist}`, midX, midY - 6);
        }
      }

      // Draw Nodes / Dots for each step
      this.sequence.forEach((cyl, s) => {
        const x = getX(s);
        const y = getY(cyl);
        const isVisited = s <= this.currentStep;
        const isCurrent = s === this.currentStep;

        ctx.beginPath();
        ctx.arc(x, y, isCurrent ? 7 : (isVisited ? 5 : 4), 0, Math.PI * 2);

        if (isCurrent) {
          ctx.fillStyle = '#00f2fe';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Outer pulsing ring
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (isVisited) {
          ctx.fillStyle = '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#1e1b4b';
          ctx.fill();
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Cylinder number label above node
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = isCurrent ? '#00f2fe' : (isVisited ? '#a7f3d0' : '#c4b5fd');
        ctx.textAlign = 'center';
        ctx.fillText(cyl, x, y - 10);
      });
    }
  }

  /**
   * 3. RENDER BENCHMARK COMPARISON BAR CHART
   */
  renderBenchmarkChart(benchmarkResults) {
    if (!this.benchmarkCanvas || !benchmarkResults || benchmarkResults.length === 0) return;
    const ctx = this.benchmarkCtx;
    const width = this.benchmarkCanvas.getBoundingClientRect().width || 900;
    const height = this.benchmarkCanvas.getBoundingClientRect().height || 260;

    const dpr = window.devicePixelRatio || 1;
    this.benchmarkCanvas.width = width * dpr;
    this.benchmarkCanvas.height = height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 30, right: 40, bottom: 40, left: 140 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxMovement = Math.max(...benchmarkResults.map(r => r.totalSeek), 100);
    const barHeight = Math.min(22, (chartH / benchmarkResults.length) - 6);

    benchmarkResults.forEach((res, idx) => {
      const y = padding.top + idx * (chartH / benchmarkResults.length) + 2;
      const barW = (res.totalSeek / maxMovement) * chartW;

      // Label (Algo Name)
      ctx.font = '11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (res.name === 'SMART') {
        ctx.fillStyle = '#00f2fe';
        ctx.font = 'bold 12px "Outfit", sans-serif';
      } else {
        ctx.fillStyle = '#94a3b8';
      }
      ctx.fillText(res.name, padding.left - 15, y + barHeight / 2);

      // Bar Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(padding.left, y, chartW, barHeight, 4);
      ctx.fill();

      // Bar Fill Gradient
      const grad = ctx.createLinearGradient(padding.left, 0, padding.left + barW, 0);
      if (idx === 0) {
        // Gold for Rank 1
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#fbbf24');
      } else if (res.name === 'SMART') {
        grad.addColorStop(0, '#00f2fe');
        grad.addColorStop(1, '#4facfe');
      } else {
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, '#8b5cf6');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(padding.left, y, Math.max(barW, 6), barHeight, 4);
      ctx.fill();

      // Total Seek Label at end of bar
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f1f5f9';
      ctx.textAlign = 'left';
      ctx.fillText(`${res.totalSeek} cyls`, padding.left + barW + 10, y + barHeight / 2);
    });
  }
}

window.DiskVisualizer = DiskVisualizer;
