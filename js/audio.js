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
    this.lagunaThemeTimer = null;
    this.lagunaFadeTimer = null;
    this.lagunaGain = null;
    this.isLagunaActive = false;
    this.lagunaPhraseIdx = 0;
    this.currentBiome = 'pradera';
    this.isMuted = false;
    this.initialized = false;
    this.waterImpactBuffer = null;

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
      },
      // Laguna del Maestro (Sala 12): Re Lidio / resonancia acuática y mística
      laguna: {
        pad: [73.42, 110.00, 146.83, 164.81, 220.00], // Re2, La2, Re3, Mi3, La3 - resonancia acuática y mística
        harp: [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25, 739.99],
        filterFreq: 450
      }
    };
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.ensureLagunaGain();
      this.initialized = true;
      this.loadWaterImpactSound();
      this.startMeadowAmbience();
      if (this.isLagunaActive) {
        this.isLagunaActive = false;
        this.enterLagunaTheme();
      }
    } catch (e) {
      console.warn("Web Audio API no soportada:", e);
    }
  }

  ensureLagunaGain() {
    if (!this.ctx) return null;
    if (!this.lagunaGain) {
      this.lagunaGain = this.ctx.createGain();
      this.lagunaGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.lagunaGain.connect(this.ctx.destination);
    }
    return this.lagunaGain;
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

  // Música pastoral luminosa (arpegios suaves de arpa sin drone/estática continua de fondo)
  startMeadowAmbience() {
    if (!this.ctx) return;

    // Desconectar y limpiar osciladores continuos de fondo si existieran
    if (this.ambientOscs && this.ambientOscs.length > 0) {
      this.ambientOscs.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (_) {}
      });
    }
    this.ambientOscs = [];

    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch (_) {}
      this.ambientGain = null;
    }
    this.ambientFilter = null;

    // Notas suaves de arpa pastoral cada pocos segundos
    if (this.arpeggioTimer) clearInterval(this.arpeggioTimer);
    this.arpeggioTimer = setInterval(() => {
      if (!this.ctx || this.isMuted || document.hidden || this.isLagunaActive) return;
      const biomeCfg = this.biomeChords[this.currentBiome] || this.biomeChords.pradera;
      const harpNotes = biomeCfg.harp;
      const freq = harpNotes[Math.floor(Math.random() * harpNotes.length)];
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.00001, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.85);
    }, 2200);
  }

  // Cambia el bioma activo para los arpegios melódicos sin usar drone continuo
  setBiomeAmbience(biome = 'pradera') {
    this.currentBiome = biome;
    if (this.ambientOscs && this.ambientOscs.length > 0) {
      this.ambientOscs.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (_) {}
      });
      this.ambientOscs = [];
    }
  }

  // Reproduce una nota de arpa de cristal / campana acuática con sutil eco de caverna
  playLagunaNote(freq, offsetSec = 0, duration = 2.4) {
    if (!this.ctx || this.isMuted || document.hidden) return;
    const masterGain = this.ensureLagunaGain();
    if (!masterGain) return;

    const now = this.ctx.currentTime + offsetSec;
    if (now < this.ctx.currentTime) return;

    // Nota directa tipo campana de agua / arpa de cristal
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + duration);

    gain.gain.setValueAtTime(0.00001, now);
    gain.gain.linearRampToValueAtTime(0.038, now + 0.055);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    // Eco sutil de gruta (~260ms después, atenuado con filtro lowpass suave)
    const echoDelay = 0.26;
    const echoNow = now + echoDelay;
    const echoDuration = Math.max(1.2, duration * 0.75);

    const echoOsc = this.ctx.createOscillator();
    const echoFilter = this.ctx.createBiquadFilter();
    const echoGain = this.ctx.createGain();

    echoOsc.type = 'sine';
    echoOsc.frequency.setValueAtTime(freq, echoNow);

    echoFilter.type = 'lowpass';
    echoFilter.frequency.setValueAtTime(750, echoNow);
    echoFilter.frequency.exponentialRampToValueAtTime(320, echoNow + echoDuration);

    echoGain.gain.setValueAtTime(0.00001, echoNow);
    echoGain.gain.linearRampToValueAtTime(0.011, echoNow + 0.07);
    echoGain.gain.exponentialRampToValueAtTime(0.00001, echoNow + echoDuration);

    echoOsc.connect(echoFilter);
    echoFilter.connect(echoGain);
    echoGain.connect(masterGain);

    echoOsc.start(echoNow);
    echoOsc.stop(echoNow + echoDuration + 0.05);
  }

  // Secuencia cíclica de frases líricas para el Tema de la Laguna
  scheduleNextLagunaPhrase() {
    if (!this.isLagunaActive || !this.ctx) return;

    const phrases = SoundManager.LAGUNA_PHRASES;
    const currentIdx = this.lagunaPhraseIdx % phrases.length;
    const phrase = phrases[currentIdx];
    this.lagunaPhraseIdx = (this.lagunaPhraseIdx + 1) % phrases.length;

    let maxEndTime = 0;
    phrase.forEach(item => {
      this.playLagunaNote(item.note, item.delay, item.dur);
      const end = item.delay + item.dur;
      if (end > maxEndTime) maxEndTime = end;
    });

    // Pausa meditativa musical: breve entre frases (1.2s), y al completar el ciclo (frase 4 -> frase 1) un respiro de 1.8s
    const isCycleEnd = (this.lagunaPhraseIdx === 0);
    const pauseBetween = isCycleEnd ? 1.8 : 1.2;
    const nextCallMs = (maxEndTime + pauseBetween) * 1000;

    this.lagunaThemeTimer = setTimeout(() => {
      this.scheduleNextLagunaPhrase();
    }, nextCallMs);
  }

  // Entra al tema musical de la Laguna del Maestro
  enterLagunaTheme() {
    if (this.lagunaFadeTimer) {
      clearTimeout(this.lagunaFadeTimer);
      this.lagunaFadeTimer = null;
    }

    this.isLagunaActive = true;
    if (!this.ctx) return;

    this.setBiomeAmbience('laguna');

    const masterGain = this.ensureLagunaGain();
    if (masterGain) {
      const now = this.ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      const currentGain = Math.max(0.00001, masterGain.gain.value);
      masterGain.gain.setValueAtTime(currentGain, now);
      masterGain.gain.linearRampToValueAtTime(1.0, now + 1.5);
    }

    if (!this.lagunaThemeTimer) {
      this.lagunaPhraseIdx = 0;
      this.scheduleNextLagunaPhrase();
    }
  }

  // Sale del tema de la Laguna del Maestro y restaura el bioma de destino de forma gradual

  // Carga y decodifica el sonido de impacto de agua contra el suelo
  loadWaterImpactSound() {
    if (!this.ctx || this.waterImpactBuffer) return;
    try {
      const b64 = SoundManager.WATER_IMPACT_B64;
      if (!b64) return;
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(bytes.buffer, (buf) => {
        this.waterImpactBuffer = buf;
      }, () => {});
    } catch (_) {}
  }

  // Reproduce el sonido de choque de agua contra el suelo (pedido del usuario)
  playWaterGroundImpact(intensity = 1.0) {
    if (this.isMuted) return;
    if (this.ctx && this.waterImpactBuffer) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.waterImpactBuffer;
        src.playbackRate.value = 0.95 + Math.random() * 0.1;
        const gain = this.ctx.createGain();
        const I = Math.max(0.2, Math.min(1.5, intensity));
        gain.gain.value = 0.5 * I;
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
        return;
      } catch (_) {}
    }
    try {
      const a = new Audio('sounds/water-impact.mp3');
      a.volume = Math.max(0.1, Math.min(1.0, 0.5 * intensity));
      a.play().catch(() => {});
    } catch (_) {}
  }

  leaveLagunaTheme(targetBiome = 'pradera') {
    this.isLagunaActive = false;
    this.setBiomeAmbience(targetBiome);

    if (this.lagunaFadeTimer) {
      clearTimeout(this.lagunaFadeTimer);
      this.lagunaFadeTimer = null;
    }

    if (this.lagunaGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.lagunaGain.gain.cancelScheduledValues(now);
      const currentGain = Math.max(0.00001, this.lagunaGain.gain.value);
      this.lagunaGain.gain.setValueAtTime(currentGain, now);
      this.lagunaGain.gain.linearRampToValueAtTime(0.00001, now + 2.5);
    }

    // Cancelar el temporizador del secuenciador tras completar el fade-out
    this.lagunaFadeTimer = setTimeout(() => {
      if (!this.isLagunaActive) {
        if (this.lagunaThemeTimer) {
          clearTimeout(this.lagunaThemeTimer);
          this.lagunaThemeTimer = null;
        }
      }
      this.lagunaFadeTimer = null;
    }, 2600);
  }
}

// Frases líricas y contemplativas en Re Lidio / Pentatónica acuática para el Tema del Maestro Arroyo
SoundManager.LAGUNA_PHRASES = [
  // Frase 1: El reflejo del agua cristalina (D4, F#4, A4, B4, A4)
  [
    { note: 293.66, delay: 0.0, dur: 2.4 }, // D4
    { note: 369.99, delay: 1.0, dur: 2.2 }, // F#4
    { note: 440.00, delay: 2.0, dur: 2.4 }, // A4
    { note: 493.88, delay: 3.2, dur: 2.8 }, // B4
    { note: 440.00, delay: 4.6, dur: 3.2 }  // A4
  ],
  // Frase 2: Murmullo de la gruta mística (F#4, A4, D5, B4, A4, F#4)
  [
    { note: 369.99, delay: 0.0, dur: 2.2 }, // F#4
    { note: 440.00, delay: 0.9, dur: 2.0 }, // A4
    { note: 587.33, delay: 1.9, dur: 2.6 }, // D5
    { note: 493.88, delay: 3.0, dur: 2.2 }, // B4
    { note: 440.00, delay: 4.0, dur: 2.2 }, // A4
    { note: 369.99, delay: 5.2, dur: 3.5 }  // F#4
  ],
  // Frase 3: Danza de gotas sobre la superficie (E4, A4, B4, D5, E5, D5)
  [
    { note: 329.63, delay: 0.0, dur: 2.2 }, // E4
    { note: 440.00, delay: 0.9, dur: 2.2 }, // A4
    { note: 493.88, delay: 1.8, dur: 2.4 }, // B4
    { note: 587.33, delay: 2.8, dur: 2.5 }, // D5
    { note: 659.25, delay: 3.8, dur: 2.8 }, // E5
    { note: 587.33, delay: 5.0, dur: 3.5 }  // D5
  ],
  // Frase 4: Paz del Maestro Arroyo / Cierre contemplativo (B4, A4, F#4, E4, D4)
  [
    { note: 493.88, delay: 0.0, dur: 2.2 }, // B4
    { note: 440.00, delay: 0.9, dur: 2.2 }, // A4
    { note: 369.99, delay: 1.9, dur: 2.4 }, // F#4
    { note: 329.63, delay: 3.0, dur: 2.6 }, // E4
    { note: 293.66, delay: 4.4, dur: 4.2 }  // D4
  ]
];

window.soundManager = new SoundManager();

// Integración nativa con GameHooks para activar la música de la Laguna del Maestro (Sala 12)
window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
if (window.GameHooks && window.GameHooks.onRoomLoad) {
  window.GameHooks.onRoomLoad.push((game, room) => {
    if (!room || !window.soundManager) return;
    if (room.id === 12 || room.name === 'LAGUNA DEL MAESTRO') {
      window.soundManager.enterLagunaTheme();
    } else if (window.soundManager.isLagunaActive) {
      window.soundManager.leaveLagunaTheme(room.biome || 'pradera');
    }
  });
}

// Audio de impacto de agua contra el suelo (MP3 en Base64)
SoundManager.WATER_IMPACT_B64 = '//vUZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//vUZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//vUZAAH8AAAaQAAAAgAAA0gAAABCbgoBK9/waAJAEABoAAEBNuYkc5X1dzKPCyIyY9CxMb2XPDDonsc1AOM0OhedPz5fzOs+kd6jPJCsNjPR2QcwcUGQMc5GijN7hPU0fEIJNPEIKjS/Tdc8b8jytWI8d5MQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUARWcFhSqK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6+jp0rCU9NjoyMnaxHROettDkkk2KFatElztqPIHUh9tkyrjp45PZZ+WgmACNxJU1tsAlPYdCVHacOnxBLOWlkkqZyyUx+bHRku+vHJ618z9YOta0JjFa0zJyYuzjTtrTPNWtOu59Z1gkiKezWh0ut3jiPSZMBXMSeQ00XG3w+O0I6cUFOsg3h/OVlMW0/B6nOZTE6Z3GDFgn6W0uKyxQ0pAAEAh6LMAtEmVzNCOYV4QkfsRtQ1lbk8zfcGR9G8JXJ06XHLC4wr18JPOVf+WFMN9ETUkULZzylRFCS0vEhDJZ1sqilm8RKEyrpet/pYiJpxqUY5/1SEUkzSYpMrNes9xj1RSxm/yl/4xpFKXihRbnVZqSLIoQqS5aHMIjXpE1HPZCz//RCGWfSJERE2aAoBUAyeZOSUTv6e0qgRRrVrAlE4+aJTp0DYtahAkO0bXnRkIQ7JYrKEarv//snFmlFmJqSIigI9BeVIa2WGTKwayxQQOSyxWCpkJul+2zMEF8rZadF0pF5Oxey0lByDwmEssI4vncy/fM7m1tW1VxyViCUzh//vUZOgMhmd1LwHsfnK2rqYGPSzOFO3YdEMNksIGOo/kJJZ5e5HE8tagvTc3NzGYL0/tzJ/nlp0VSkUjtZel6XzO/nlpkOIqIRXPH+/NzNyZmzLUF++eszAw/F7q45TF1DSL3H4v782l4nj0Qg5GkkFtEqdXHKZM2xfKtJUjngMtX3foqJ+iqmUUAiIHQPIEbG5sZVf/isqWOLoG83JRuv8khIip1A27c/u83JRIhCNDRdBOokQhB4DiMke7YyVThPP4rJpwnm5/djFEhEYMEyO3///RNjFDwChIKCYcO2qJ+qIdn/+iois/6s7GDoDBEIiAuzyiQRCw4LjnKJCIgqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
