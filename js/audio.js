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
    this.isLagunaActive = false;
    this.lagunaPhraseIdx = 0;
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
      this.initialized = true;
      this.startMeadowAmbience();
      if (this.isLagunaActive) {
        this.isLagunaActive = false;
        this.enterLagunaTheme();
      }
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
    gain.connect(this.ctx.destination);

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
    echoGain.connect(this.ctx.destination);

    echoOsc.start(echoNow);
    echoOsc.stop(echoNow + echoDuration + 0.05);
  }

  // Secuencia cíclica de frases líricas para el Tema de la Laguna
  scheduleNextLagunaPhrase() {
    if (!this.isLagunaActive || !this.ctx) return;

    const phrase = SoundManager.LAGUNA_PHRASES[this.lagunaPhraseIdx % SoundManager.LAGUNA_PHRASES.length];
    this.lagunaPhraseIdx = (this.lagunaPhraseIdx + 1) % SoundManager.LAGUNA_PHRASES.length;

    let maxEndTime = 0;
    phrase.forEach(item => {
      this.playLagunaNote(item.note, item.delay, item.dur);
      const end = item.delay + item.dur;
      if (end > maxEndTime) maxEndTime = end;
    });

    // Silencio meditativo entre frases (armoniza con el sonido ambiente de agua)
    const pauseBetween = 4.0;
    const nextCallMs = (maxEndTime + pauseBetween) * 1000;

    this.lagunaThemeTimer = setTimeout(() => {
      this.scheduleNextLagunaPhrase();
    }, nextCallMs);
  }

  // Entra al tema musical de la Laguna del Maestro
  enterLagunaTheme() {
    if (this.isLagunaActive && this.lagunaThemeTimer) return;
    this.isLagunaActive = true;
    if (!this.ctx) return;

    this.setBiomeAmbience('laguna');

    if (this.lagunaThemeTimer) {
      clearTimeout(this.lagunaThemeTimer);
      this.lagunaThemeTimer = null;
    }

    this.lagunaPhraseIdx = 0;
    this.scheduleNextLagunaPhrase();
  }

  // Sale del tema de la Laguna del Maestro y restaura el bioma de destino
  leaveLagunaTheme(targetBiome = 'pradera') {
    this.isLagunaActive = false;
    if (this.lagunaThemeTimer) {
      clearTimeout(this.lagunaThemeTimer);
      this.lagunaThemeTimer = null;
    }
    this.setBiomeAmbience(targetBiome);
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
