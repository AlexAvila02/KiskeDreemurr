/**
 * Gestor de Audio Sintetizado con Web Audio API
 * Música pastoral luminosa por bioma y efectos de sonido clásicos sin archivos externos.
 */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.ambientOscs = [];
    this.arpeggioTimer = null;
    this.currentBiome = 'pradera';
    this.isMuted = false;
    this.initialized = false;

    // Acordes pastorales y atmosféricos según la zona del reino (ver docs/LORE.md)
    this.biomeChords = {
      // Praderas del Reino Caído: Sol Mayor 9 (G2, B2, D3, F#3, A3) - cálido y esperanzador
      pradera: {
        pad: [98.00, 123.47, 146.83, 185.00],
        harp: [293.66, 369.99, 392.00, 440.00, 493.88, 587.33],
        filterFreq: 380
      },
      // Bosque de los Susurros: Mi menor 9 / Dórico (E2, B2, D3, F#3, G3) - misterioso y frondoso
      bosque: {
        pad: [82.41, 123.47, 146.83, 164.81],
        harp: [246.94, 293.66, 329.63, 369.99, 392.00, 493.88],
        filterFreq: 310
      },
      // Paso de la Montaña Gris: Do Lidio / Cuartas abiertas (C2, G2, D3, E3) - aire frío de altura
      montana: {
        pad: [65.41, 98.00, 146.83, 164.81],
        harp: [261.63, 329.63, 392.00, 493.88, 523.25],
        filterFreq: 290
      },
      // Castillo Abandonado: La menor / Re menor real (A2, E3, G3, C4) - noble y nostálgico
      castillo: {
        pad: [110.00, 164.81, 196.00, 220.00],
        harp: [220.00, 261.63, 329.63, 392.00, 440.00],
        filterFreq: 340
      }
    };
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.startMeadowAmbience();
    } catch (e) {
      console.warn("Web Audio API no soportada:", e);
    }
  }

  // Sonido de Salto normal (ágil y cálido)
  playJump() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.13);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Sonido de Doble Salto (acorde mayor brillante estilo animación clásica)
  playDoubleJump() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [392.00, 493.88, 587.33, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.025);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.22);

      gain.gain.setValueAtTime(0.11, now + idx * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.025);
      osc.stop(now + 0.24);
    });
  }

  // Sonido de Corte de Espada
  playSlash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.11);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + 0.10);
    filter.Q.setValueAtTime(2.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start(now);
  }

  // Sonido de Impacto / Golpe
  playHit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Sonido al recoger objeto, nota o llave
  playPickup() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);

      gain.gain.setValueAtTime(0.16, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.26);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.28);
    });
  }

  // Sonido al lanzar piedra
  playThrow() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.17);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  // Sonido de Portón abriéndose
  playDoorUnlock() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [196.00, 246.94, 293.66, 392.00].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.2, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.46);
    });
  }

  // Sonido al romper un muro o puente frágil con ingenio
  playBreakWall() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [140, 95, 70].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(35, now + i * 0.04 + 0.22);
      gain.gain.setValueAtTime(0.25, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.25);
    });
  }

  // Sonido al desbloquear una mejora o habilidad nueva
  playUnlockAbility() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [392.00, 493.88, 587.33, 783.99, 987.77].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.2, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.52);
    });
  }

  // Alias por compatibilidad
  startCavernAmbience() {
    this.startMeadowAmbience();
  }

  // Música pastoral luminosa de pradera (acorde mayor cálido + notas suaves de arpa)
  startMeadowAmbience() {
    if (!this.ctx) return;
    const cfg = this.biomeChords[this.currentBiome] || this.biomeChords.pradera;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.035, this.ctx.currentTime);
    this.ambientGain.connect(this.ctx.destination);

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(cfg.filterFreq, this.ctx.currentTime);
    this.ambientFilter.connect(this.ambientGain);

    this.ambientOscs = cfg.pad.map((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(this.ambientFilter);
      osc.start();
      return osc;
    });

    // Notas suaves de arpa pastoral cada pocos segundos
    if (this.arpeggioTimer) clearInterval(this.arpeggioTimer);
    this.arpeggioTimer = setInterval(() => {
      if (!this.ctx || this.isMuted || document.hidden) return;
      const biomeCfg = this.biomeChords[this.currentBiome] || this.biomeChords.pradera;
      const harpNotes = biomeCfg.harp;
      const freq = harpNotes[Math.floor(Math.random() * harpNotes.length)];
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.85);
    }, 2200);
  }

  // Cambia suavemente el acorde de fondo al cambiar de zona/bioma
  setBiomeAmbience(biome = 'pradera') {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;
    if (!this.ctx || !this.ambientOscs.length) return;

    const cfg = this.biomeChords[biome] || this.biomeChords.pradera;
    const now = this.ctx.currentTime;
    if (this.ambientFilter) {
      this.ambientFilter.frequency.linearRampToValueAtTime(cfg.filterFreq, now + 1.2);
    }
    this.ambientOscs.forEach((osc, idx) => {
      if (cfg.pad[idx]) {
        osc.frequency.linearRampToValueAtTime(cfg.pad[idx], now + 1.2);
      }
    });
  }
}

window.soundManager = new SoundManager();
