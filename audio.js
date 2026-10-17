/**
 * Web Audio API Sound Synthesizer for Mechanical Hard Disk Simulation
 * Procedural voice coil actuator seeks, spindle motor hum, and servicing chimes.
 */

class DiskAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.motorOsc = null;
    this.motorGain = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.enabled = !this.enabled;
    if (this.enabled) {
      this.startSpindleHum();
    } else {
      this.stopSpindleHum();
    }
    return this.enabled;
  }

  startSpindleHum() {
    if (!this.ctx || !this.enabled) return;
    try {
      this.stopSpindleHum();

      // 7200 RPM = 120 Hz fundamental frequency
      this.motorOsc = this.ctx.createOscillator();
      this.motorGain = this.ctx.createGain();

      this.motorOsc.type = 'triangle';
      this.motorOsc.frequency.setValueAtTime(120, this.ctx.currentTime);

      // Low pass filter to simulate heavy metallic chassis enclosure
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);

      this.motorGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

      this.motorOsc.connect(filter);
      filter.connect(this.motorGain);
      this.motorGain.connect(this.ctx.destination);

      this.motorOsc.start();
    } catch (e) {
      console.warn('Audio hum error:', e);
    }
  }

  stopSpindleHum() {
    if (this.motorOsc) {
      try {
        this.motorOsc.stop();
        this.motorOsc.disconnect();
      } catch (e) {}
      this.motorOsc = null;
    }
  }

  /**
   * Sound of voice coil actuator jumping tracks
   * Short mechanical acoustic impulse
   */
  playSeekClick(distance = 10) {
    if (!this.ctx || !this.enabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 800 + Math.min(distance * 4, 1200);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  /**
   * High-tech target serviced chime
   */
  playServicedChime() {
    if (!this.ctx || !this.enabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }
}

const diskAudio = new DiskAudioEngine();
window.diskAudio = diskAudio;
