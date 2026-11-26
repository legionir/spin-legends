import { WeatherType } from '../domain/types';
import {
  LOAD_PRIORITY,
  SOUND_GROUPS,
  STATUS_LOOP_IDS,
  SoundBus,
  StatusLoopId,
  abilitySoundKey,
} from './audioManifest';

// APK builds set VITE_AUDIO_BASE (e.g. 'js/') because Sweetmelon only bundles top-level www/, css/, js/, img/ files.
const AUDIO_BASE: string =
  (import.meta.env?.VITE_AUDIO_BASE as string | undefined) || `${import.meta.env?.BASE_URL ?? '/'}audio/`;

interface PlayOpts {
  gain?: number;
  rate?: number;
  delay?: number;
  loop?: boolean;
  /** fade in seconds (loops) */
  fadeIn?: number;
}

interface LoopVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const WEATHER_BED: Partial<Record<WeatherType, string>> = {
  LightRain: 'amb.rain',
  DustStorm: 'amb.dust',
  GaleWind: 'amb.gale',
};

class SpinSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private spinOsc1: OscillatorNode | null = null;
  private spinOsc2: OscillatorNode | null = null;
  private spinFilter: BiquadFilterNode | null = null;
  private spinGain: GainNode | null = null;
  private muted = false;
  private volume = 0.7;
  private unlocked = false;

  // Dynamic Ambient Weather Sound system
  private weatherGain: GainNode | null = null;
  private weatherFilter: BiquadFilterNode | null = null;
  private weatherLfo: OscillatorNode | null = null;
  private weatherLfoGain: GainNode | null = null;
  private weatherNoiseSource: AudioBufferSourceNode | null = null;
  private currentWeather: WeatherType = 'Clear';
  private weatherActive = false;
  private weatherGustTime = 0;
  private weatherParamThrottleTimer = 0;
  private rainDropTimer = 0.08;
  private weatherGritTimer = 0.35;
  private thunderTimer = 22.0;

  // Dynamic Procedural Battle Music state
  private musicEnabled = true;
  private musicTimerId: number | null = null;
  private musicStep = 0;
  private musicIsCritical = false;

  // Sampled audio (public/audio/*.ogg). Every public play* method tries the sample first
  // and falls back to the original synth voice while files load or if decoding fails.
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadStarted = false;
  private lastVariant = new Map<string, number>();
  private lastPlayAt = new Map<string, number>();
  private activeVoices = new Map<string, number>();
  private menuMusic: LoopVoice | null = null;
  private battleMusic: LoopVoice | null = null;
  private criticalMusic: LoopVoice | null = null;
  private criticalMix = 0;
  private ambBed: { id: string; voice: LoopVoice } | null = null;
  private statusLoops = new Map<StatusLoopId, LoopVoice>();
  private menuMusicWanted = false;

  public unlock(): void {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1.0;
      this.sfxBus.connect(this.masterGain);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.masterGain);
      this.ambBus = this.ctx.createGain();
      this.ambBus.gain.value = 0.6;
      this.ambBus.connect(this.masterGain);

      this.spinGain = this.ctx.createGain();
      this.spinGain.gain.value = 0;

      this.spinFilter = this.ctx.createBiquadFilter();
      this.spinFilter.type = 'bandpass';
      this.spinFilter.frequency.value = 260;
      this.spinFilter.Q.value = 2.4;

      this.spinOsc1 = this.ctx.createOscillator();
      this.spinOsc1.type = 'sawtooth';
      this.spinOsc1.frequency.value = 110;

      this.spinOsc2 = this.ctx.createOscillator();
      this.spinOsc2.type = 'triangle';
      this.spinOsc2.frequency.value = 165;

      this.spinOsc1.connect(this.spinFilter);
      this.spinOsc2.connect(this.spinFilter);
      this.spinFilter.connect(this.spinGain);
      this.spinGain.connect(this.masterGain);

      this.spinOsc1.start();
      this.spinOsc2.start();

      // Atmospheric Weather Ambient Noise Sub-graph
      this.weatherGain = this.ctx.createGain();
      this.weatherGain.gain.value = 0;

      this.weatherFilter = this.ctx.createBiquadFilter();
      this.weatherFilter.type = 'bandpass';
      this.weatherFilter.frequency.value = 1800;
      this.weatherFilter.Q.value = 1.0;

      this.weatherLfo = this.ctx.createOscillator();
      this.weatherLfo.type = 'sine';
      this.weatherLfo.frequency.value = 0.42;

      this.weatherLfoGain = this.ctx.createGain();
      this.weatherLfoGain.gain.value = 320;

      this.weatherLfo.connect(this.weatherLfoGain);
      this.weatherLfoGain.connect(this.weatherFilter.frequency);
      this.weatherLfo.start();

      // 3.5s seamless looping atmospheric noise buffer (pink noise tailored for rain/wind/sand)
      const noiseLen = Math.floor(this.ctx.sampleRate * 3.5);
      const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
      const nData = noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < noiseLen; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        nData[i] = (b0 + b1 + b2 + white * 0.5362) * 0.22;
      }

      this.weatherNoiseSource = this.ctx.createBufferSource();
      this.weatherNoiseSource.buffer = noiseBuf;
      this.weatherNoiseSource.loop = true;
      this.weatherNoiseSource.connect(this.weatherFilter);
      this.weatherFilter.connect(this.weatherGain);
      this.weatherGain.connect(this.masterGain);
      this.weatherNoiseSource.start();

      this.unlocked = true;
      void this.loadSamples();
      if (this.weatherActive && !this.muted && this.currentWeather !== 'Clear') {
        this.applyWeatherParams(this.ctx.currentTime, this.currentWeather);
      }
    } catch {
      // Audio unavailable
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
    if (muted) {
      this.stopMusicLoop();
      this.stopSampleMusic(0.05);
      this.stopMenuMusic(0.05);
      this.stopAmbBed(0.05);
      this.setStatusLoops([]);
      if (this.weatherGain && this.ctx) {
        this.weatherGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
    } else if (this.weatherActive) {
      this.setWeatherAmbiance(this.currentWeather, true, true);
    }
  }

  public suspendForBackground(): void {
    this.stopMusicLoop();
    if (this.spinGain && this.ctx) {
      this.spinGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
    if (this.weatherGain && this.ctx) {
      this.weatherGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  public resumeFromBackground(): void {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      void this.ctx.resume();
    }
    if (this.weatherActive && !this.muted) {
      this.setWeatherAmbiance(this.currentWeather, true, true);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public playRainDrop(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();

      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(3200 + Math.random() * 2400, now);
      filt.Q.setValueAtTime(4.2, now);

      osc.type = 'sine';
      const pitch = 650 + Math.random() * 450;
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.024);

      const dropVol = 0.007 + Math.random() * 0.013;
      g.gain.setValueAtTime(dropVol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

      osc.connect(filt);
      filt.connect(g);
      g.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.028);
    } catch {
      // Audio context busy
    }
  }

  public playGritSwirl(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();

      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(900 + Math.random() * 600, now);
      filt.Q.setValueAtTime(2.8, now);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 120, now);

      const gritVol = 0.006 + Math.random() * 0.008;
      g.gain.setValueAtTime(gritVol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(filt);
      filt.connect(g);
      g.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.085);
    } catch {
      // Audio context busy
    }
  }

  private synthDistantThunder(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();

      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(180, now);
      filt.frequency.exponentialRampToValueAtTime(45, now + 1.2);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(58, now);
      osc.frequency.linearRampToValueAtTime(32, now + 1.2);

      g.gain.setValueAtTime(0.018, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

      osc.connect(filt);
      filt.connect(g);
      g.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.35);
    } catch {
      // Audio context busy
    }
  }

  public updateWeatherDynamics(dt: number, combatIntensity = 1.0): void {
    if (this.ambBed && this.ctx && !this.muted && this.weatherActive) {
      // Recorded bed: only lift it a little with combat tension and roll distant thunder.
      const target = (SOUND_GROUPS[this.ambBed.id]?.gain ?? 0.9) * Math.max(0.85, Math.min(1.25, combatIntensity));
      this.ambBed.voice.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
      if (this.currentWeather === 'LightRain') {
        this.thunderTimer -= dt;
        if (this.thunderTimer <= 0) {
          this.playThunder();
          this.thunderTimer = 16.0 + Math.random() * 22.0;
        }
      }
      return;
    }
    if (
      !this.weatherActive ||
      this.muted ||
      this.currentWeather === 'Clear' ||
      !this.ctx ||
      !this.weatherGain ||
      !this.weatherFilter ||
      !this.weatherLfo ||
      !this.weatherLfoGain
    ) {
      return;
    }

    this.weatherGustTime += dt;
    this.weatherParamThrottleTimer -= dt;
    const shouldScheduleParams = this.weatherParamThrottleTimer <= 0;
    if (shouldScheduleParams) {
      this.weatherParamThrottleTimer = 0.06; // ~16Hz smooth AudioParam modulation
    }
    const now = this.ctx.currentTime;
    const tension = Math.max(0.85, Math.min(1.5, combatIntensity));

    switch (this.currentWeather) {
      case 'DustStorm': {
        // Multi-frequency procedural wind turbulence with howling gust squalls
        const gustWave =
          Math.sin(this.weatherGustTime * 0.48) * 0.44 +
          Math.sin(this.weatherGustTime * 1.22 + 1.3) * 0.36 +
          Math.sin(this.weatherGustTime * 0.21) * 0.2;
        const normGust = Math.max(0, Math.min(1, (gustWave + 1) * 0.5));

        if (shouldScheduleParams) {
          const baseGain = 0.038 * tension;
          const peakGain = 0.092 * tension;
          const dynamicGain = baseGain + normGust * (peakGain - baseGain);
          const dynamicFreq = 500 + normGust * 460; // 500Hz -> 960Hz howling wind
          const dynamicQ = 1.5 + normGust * 1.5;

          this.weatherGain.gain.setTargetAtTime(dynamicGain, now, 0.12);
          this.weatherFilter.frequency.setTargetAtTime(dynamicFreq, now, 0.15);
          this.weatherFilter.Q.setTargetAtTime(dynamicQ, now, 0.15);
          this.weatherLfoGain.gain.setTargetAtTime(200 + normGust * 220, now, 0.15);
        }

        // Dry sand grit bursts when gusts peak
        this.weatherGritTimer -= dt;
        if (this.weatherGritTimer <= 0) {
          if (normGust > 0.42) {
            this.playGritSwirl();
          }
          this.weatherGritTimer = 0.18 + Math.random() * 0.35;
        }
        break;
      }

      case 'LightRain': {
        // Ambient rain downpour swells with natural shower squalls
        const rainSwell =
          Math.sin(this.weatherGustTime * 0.34) * 0.52 +
          Math.sin(this.weatherGustTime * 0.88 + 0.8) * 0.48;
        const normRain = Math.max(0, Math.min(1, (rainSwell + 1) * 0.5));

        if (shouldScheduleParams) {
          const baseRainGain = 0.04 * tension;
          const peakRainGain = 0.078 * tension;
          const dynamicGain = baseRainGain + normRain * (peakRainGain - baseRainGain);
          const dynamicFreq = 2300 + normRain * 750; // 2300Hz -> 3050Hz rain hiss

          this.weatherGain.gain.setTargetAtTime(dynamicGain, now, 0.15);
          this.weatherFilter.frequency.setTargetAtTime(dynamicFreq, now, 0.18);
        }

        // Procedural raindrop patter engine: stochastic droplets impact the arena dish
        this.rainDropTimer -= dt;
        if (this.rainDropTimer <= 0) {
          this.playRainDrop();
          this.rainDropTimer = 0.04 + (1 - normRain * 0.5) * (0.05 + Math.random() * 0.09);
        }

        // Periodic distant atmospheric thunder rolls
        this.thunderTimer -= dt;
        if (this.thunderTimer <= 0) {
          this.playThunder();
          this.thunderTimer = 20.0 + Math.random() * 25.0;
        }
        break;
      }

      case 'GaleWind': {
        // Dynamic stadium crosswinds with whistling vortex draft modulation
        const windWave =
          Math.sin(this.weatherGustTime * 0.62) * 0.48 +
          Math.sin(this.weatherGustTime * 1.45 + 2.1) * 0.34 +
          Math.sin(this.weatherGustTime * 0.17) * 0.18;
        const normWind = Math.max(0, Math.min(1, (windWave + 1) * 0.5));

        if (shouldScheduleParams) {
          const baseWindGain = 0.036 * tension;
          const peakWindGain = 0.084 * tension;
          const dynamicGain = baseWindGain + normWind * (peakWindGain - baseWindGain);
          const dynamicFreq = 380 + normWind * 420;

          this.weatherGain.gain.setTargetAtTime(dynamicGain, now, 0.12);
          this.weatherFilter.frequency.setTargetAtTime(dynamicFreq, now, 0.15);
          this.weatherLfoGain.gain.setTargetAtTime(160 + normWind * 180, now, 0.15);
        }
        break;
      }
    }
  }

  private applyWeatherParams(now: number, weather: WeatherType): void {
    if (
      !this.weatherGain ||
      !this.weatherFilter ||
      !this.weatherLfo ||
      !this.weatherLfoGain
    ) {
      return;
    }
    switch (weather) {
      case 'LightRain':
        this.weatherFilter.type = 'bandpass';
        this.weatherFilter.frequency.setTargetAtTime(2600, now, 0.15);
        this.weatherFilter.Q.setTargetAtTime(0.85, now, 0.15);
        this.weatherLfo.frequency.setTargetAtTime(1.2, now, 0.15);
        this.weatherLfoGain.gain.setTargetAtTime(450, now, 0.15);
        this.weatherGain.gain.setTargetAtTime(0.048, now, 0.12);
        break;
      case 'DustStorm':
        this.weatherFilter.type = 'bandpass';
        this.weatherFilter.frequency.setTargetAtTime(580, now, 0.15);
        this.weatherFilter.Q.setTargetAtTime(1.8, now, 0.15);
        this.weatherLfo.frequency.setTargetAtTime(0.55, now, 0.15);
        this.weatherLfoGain.gain.setTargetAtTime(260, now, 0.15);
        this.weatherGain.gain.setTargetAtTime(0.058, now, 0.12);
        break;
      case 'GaleWind':
        this.weatherFilter.type = 'lowpass';
        this.weatherFilter.frequency.setTargetAtTime(420, now, 0.15);
        this.weatherFilter.Q.setTargetAtTime(2.2, now, 0.15);
        this.weatherLfo.frequency.setTargetAtTime(0.32, now, 0.15);
        this.weatherLfoGain.gain.setTargetAtTime(220, now, 0.15);
        this.weatherGain.gain.setTargetAtTime(0.052, now, 0.12);
        break;
    }
  }

  public setWeatherAmbiance(weather: WeatherType, active: boolean, forceApply = false): void {
    const isChange = this.currentWeather !== weather || this.weatherActive !== active;
    this.currentWeather = weather;
    this.weatherActive = active;
    if (
      !this.ctx ||
      !this.weatherGain ||
      !this.weatherFilter ||
      !this.weatherLfo ||
      !this.weatherLfoGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted || weather === 'Clear') {
      this.weatherGain.gain.setTargetAtTime(0, now, 0.12);
      this.stopAmbBed(0.8);
      return;
    }

    const bedId = WEATHER_BED[weather];
    if (bedId && this.has(bedId)) {
      // recorded bed replaces the synthesized noise layer
      this.weatherGain.gain.setTargetAtTime(0, now, 0.12);
      if (!this.ambBed || this.ambBed.id !== bedId || forceApply) {
        if (!this.ambBed || this.ambBed.id !== bedId) {
          this.stopAmbBed(1.2);
          const voice = this.startLoop(bedId, { fadeIn: 1.5 });
          if (voice) this.ambBed = { id: bedId, voice };
        }
      }
      return;
    }
    this.stopAmbBed(0.8);

    if (isChange) {
      this.weatherGustTime = 0;
      this.weatherParamThrottleTimer = 0;
    }
    if (isChange || forceApply) {
      this.applyWeatherParams(now, weather);
    }
  }

  private synthDynamicMusic(enabled: boolean, active: boolean, isCritical: boolean): void {
    this.musicEnabled = enabled;
    this.musicIsCritical = isCritical;
    if (!enabled || !active || this.muted || !this.ctx || !this.masterGain || document.hidden) {
      this.stopMusicLoop();
      return;
    }
    if (this.musicTimerId === null) {
      this.musicTimerId = window.setInterval(() => {
        this.playMusicPulse();
      }, 170);
    }
  }

  private stopMusicLoop(): void {
    if (this.musicTimerId !== null) {
      clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  private playMusicPulse(): void {
    if (!this.ctx || !this.masterGain || this.muted || !this.musicEnabled) return;
    if (this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;
    const step = this.musicStep % 16;
    this.musicStep += 1;

    // Layer 1: Driving synth bass pulse on 8th beats
    if (step % 2 === 0) {
      const bassNotes = this.musicIsCritical
        ? [73.42, 73.42, 87.31, 98.0]
        : [65.41, 65.41, 77.78, 87.31];
      const freq = bassNotes[Math.floor(step / 4) % bassNotes.length];
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(this.musicIsCritical ? 540 : 340, now);
      g.gain.setValueAtTime(0.032, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    // Layer 2: High-tension arena arp during Critical / accented beats
    if (this.musicIsCritical || step % 4 === 2) {
      const arpScale = this.musicIsCritical
        ? [293.66, 349.23, 440, 523.25]
        : [261.63, 311.13, 392, 466.16];
      const note = arpScale[step % arpScale.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, now);
      g.gain.setValueAtTime(this.musicIsCritical ? 0.024 : 0.016, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
    }
  }

  public updateSpinHum(active: boolean, playerOmega: number, oppOmega: number): void {
    if (!this.ctx || !this.spinGain || !this.spinOsc1 || !this.spinOsc2 || !this.spinFilter) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.spinGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }
    const avgOmega = (playerOmega + oppOmega) * 0.5;
    const norm = Math.min(1.2, avgOmega / 115);
    this.spinOsc1.frequency.setTargetAtTime(75 + norm * 145, now, 0.05);
    this.spinOsc2.frequency.setTargetAtTime(112 + norm * 220, now, 0.05);
    this.spinFilter.frequency.setTargetAtTime(180 + norm * 520, now, 0.05);
    this.spinGain.gain.setTargetAtTime(0.035 + norm * 0.05, now, 0.08);
  }

  private synthLaunch(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.28);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  private synthLaunchSlam(power = 0.8): void {
    if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const clampedPow = Math.max(0.3, Math.min(1.3, power));
      const pitchVar = 0.94 + Math.random() * 0.12;

      // Heavy stadium dish thump on touchdown
      const thud = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(112 * pitchVar, now);
      thud.frequency.exponentialRampToValueAtTime(36, now + 0.13);
      thudGain.gain.setValueAtTime(0.26 * clampedPow, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      thud.connect(thudGain);
      thudGain.connect(this.masterGain);
      thud.start(now);
      thud.stop(now + 0.15);

      // Sharp metal tip-on-bowl clack + secondary microscopic bounce tick
      for (const [offsetSec, amp] of [
        [0, 1.0],
        [0.055, 0.34],
      ] as const) {
        const t = now + offsetSec;
        for (const freq of [880, 1520]) {
          const ring = this.ctx.createOscillator();
          const rg = this.ctx.createGain();
          ring.type = 'sine';
          ring.frequency.setValueAtTime(freq * pitchVar, t);
          ring.frequency.exponentialRampToValueAtTime(freq * pitchVar * 0.72, t + 0.08);
          rg.gain.setValueAtTime(0.075 * clampedPow * amp, t);
          rg.gain.exponentialRampToValueAtTime(0.0005, t + 0.085);
          ring.connect(rg);
          rg.connect(this.masterGain);
          ring.start(t);
          ring.stop(t + 0.09);
        }
      }

      // Crisp dust/grit floor contact puff
      const noiseBuf = this.getSparkNoiseBuffer();
      if (noiseBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = noiseBuf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.Q.value = 1.8;
        filt.frequency.setValueAtTime(2600, now);
        filt.frequency.exponentialRampToValueAtTime(620, now + 0.09);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.11 * clampedPow, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        src.connect(filt);
        filt.connect(ng);
        ng.connect(this.masterGain);
        src.start(now);
        src.stop(now + 0.11);
      }
    } catch {
      // Audio context busy
    }
  }

  private sparkNoiseBuffer: AudioBuffer | null = null;

  private getSparkNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.sparkNoiseBuffer && this.sparkNoiseBuffer.sampleRate === this.ctx.sampleRate) {
      return this.sparkNoiseBuffer;
    }
    const length = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Exponentially decaying crackly white noise
      const env = Math.pow(1 - i / length, 1.8);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    this.sparkNoiseBuffer = buffer;
    return buffer;
  }

  private synthCollision(intensity: number, isCritical = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;
    const clampedIntensity = Math.max(0.25, Math.min(1.5, intensity));
    const vol = Math.min(0.62, 0.18 + clampedIntensity * 0.28);

    // 1. Inharmonic steel-on-steel metallic ring
    const freqs = isCritical
      ? [640, 1140, 1890, 2780]
      : [520, 910, 1490];
    const ringDur = isCritical ? 0.34 : 0.19;
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : idx === 1 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f * pitchVar, now);
      osc.frequency.exponentialRampToValueAtTime(f * pitchVar * 0.62, now + ringDur);
      g.gain.setValueAtTime((vol * (idx === 1 ? 0.55 : 0.9)) / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + ringDur);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + ringDur + 0.02);
    });

    // 2. Fiery spark crackle & metallic scrape burst
    const noiseBuf = this.getSparkNoiseBuffer();
    if (noiseBuf) {
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = isCritical ? 1.4 : 2.0;
      filt.frequency.setValueAtTime(isCritical ? 5200 : 3800, now);
      filt.frequency.exponentialRampToValueAtTime(850, now + (isCritical ? 0.25 : 0.15));
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(vol * (isCritical ? 0.85 : 0.55), now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + (isCritical ? 0.26 : 0.16));
      noiseSrc.connect(filt);
      filt.connect(ng);
      ng.connect(this.masterGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.28);
    }

    // 3. Heavy sub-bass thump impact
    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(isCritical ? 165 : 138, now);
    punch.frequency.exponentialRampToValueAtTime(34, now + (isCritical ? 0.16 : 0.11));
    punchGain.gain.setValueAtTime(vol * (isCritical ? 1.15 : 0.95), now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + (isCritical ? 0.18 : 0.12));
    punch.connect(punchGain);
    punchGain.connect(this.masterGain);
    punch.start(now);
    punch.stop(now + 0.19);
  }

  private synthAbility(isUltimate = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = isUltimate ? [330, 440, 660, 880] : [392, 587];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = isUltimate ? 'sawtooth' : 'sine';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playClick(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private synthBurst(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [220, 440, 880, 1320].forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.3, now + 0.45);
      g.gain.setValueAtTime(0.22 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  private synthPerfectLaunch(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.03, t + 0.28);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  private synthOutcome(won: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const seq = won ? [440, 554.37, 659.25, 880] : [392, 349.23, 293.66];
    seq.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.11;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  // ---------------------------------------------------------------------------
  // Sample bank
  // ---------------------------------------------------------------------------

  private async loadSamples(): Promise<void> {
    if (this.loadStarted || !this.ctx) return;
    this.loadStarted = true;
    const files: string[] = [];
    for (const g of LOAD_PRIORITY) files.push(...(SOUND_GROUPS[g]?.files ?? []));
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const name = files[next++];
        await this.loadOne(name);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    // late-loaded beds/music: pick up whatever state the game is already in
    if (this.weatherActive) this.setWeatherAmbiance(this.currentWeather, true, true);
    if (this.menuMusicWanted) this.setMenuMusic(true);
  }

  private async loadOne(name: string): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.buffers.has(name)) return;
    try {
      const res = await fetch(`${AUDIO_BASE}${name}.ogg`);
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((resolve, reject) => {
        const p = ctx.decodeAudioData(data, resolve, reject);
        if (p && typeof (p as Promise<AudioBuffer>).then === 'function') {
          (p as Promise<AudioBuffer>).then(resolve, reject);
        }
      });
      if (this.ctx === ctx) this.buffers.set(name, buf);
    } catch {
      // Missing file or codec unsupported (e.g. old Safari without Vorbis): synth fallback stays.
    }
  }

  /** true when at least one file of the group is decoded */
  private has(group: string): boolean {
    const g = SOUND_GROUPS[group];
    return Boolean(g && g.files.some((f) => this.buffers.has(f)));
  }

  private busFor(bus: SoundBus): GainNode | null {
    return bus === 'music' ? this.musicBus : bus === 'amb' ? this.ambBus : this.sfxBus;
  }

  private pickBuffer(group: string): AudioBuffer | null {
    const g = SOUND_GROUPS[group];
    if (!g) return null;
    const ready = g.files.map((f, i) => [i, this.buffers.get(f)] as const).filter(([, b]) => b);
    if (ready.length === 0) return null;
    const last = this.lastVariant.get(group);
    const pool = ready.length > 1 ? ready.filter(([i]) => i !== last) : ready;
    const [idx, buf] = pool[Math.floor(Math.random() * pool.length)];
    this.lastVariant.set(group, idx);
    return buf ?? null;
  }

  private playSample(group: string, opts: PlayOpts = {}): LoopVoice | null {
    const ctx = this.ctx;
    const g = SOUND_GROUPS[group];
    if (!ctx || !g || this.muted || ctx.state === 'closed') return null;
    const bus = this.busFor(g.bus);
    if (!bus) return null;
    const now = ctx.currentTime;
    if (!opts.loop) {
      if (g.minInterval && now - (this.lastPlayAt.get(group) ?? -1) < g.minInterval) return null;
      if (g.maxVoices && (this.activeVoices.get(group) ?? 0) >= g.maxVoices) return null;
    }
    const buf = this.pickBuffer(group);
    if (!buf) return null;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = Boolean(opts.loop);
      const jitter = g.pitchJitter ?? 0;
      src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter);
      const gain = ctx.createGain();
      const level = g.gain * (opts.gain ?? 1);
      const t = now + (opts.delay ?? 0);
      if (opts.fadeIn) {
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(level, t + opts.fadeIn);
      } else {
        gain.gain.value = level;
      }
      src.connect(gain);
      gain.connect(bus);
      src.start(t);
      if (!opts.loop) {
        this.lastPlayAt.set(group, now);
        this.activeVoices.set(group, (this.activeVoices.get(group) ?? 0) + 1);
        src.onended = () => {
          this.activeVoices.set(group, Math.max(0, (this.activeVoices.get(group) ?? 1) - 1));
          try {
            gain.disconnect();
          } catch {
            // already gone
          }
        };
      }
      return { src, gain };
    } catch {
      return null;
    }
  }

  private startLoop(group: string, opts: PlayOpts = {}): LoopVoice | null {
    return this.playSample(group, { ...opts, loop: true });
  }

  private stopLoop(voice: LoopVoice | null, fade = 0.4): void {
    if (!voice || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fade));
      voice.src.stop(now + Math.max(0.01, fade) + 0.02);
    } catch {
      // already stopped
    }
  }

  // ---------------------------------------------------------------------------
  // Music: menu loop, battle loop + phase-locked Critical layer, stingers
  // ---------------------------------------------------------------------------

  public setMenuMusic(active: boolean): void {
    this.menuMusicWanted = active;
    if (!active || this.muted || !this.musicEnabled || !this.ctx) {
      this.stopMenuMusic(0.8);
      return;
    }
    if (this.menuMusic || !this.has('music.menu') || this.ctx.state !== 'running') return;
    this.menuMusic = this.startLoop('music.menu', { fadeIn: 1.2 });
  }

  private stopMenuMusic(fade: number): void {
    if (!this.menuMusic) return;
    this.stopLoop(this.menuMusic, fade);
    this.menuMusic = null;
  }

  public setDynamicMusic(enabled: boolean, active: boolean, isCritical: boolean): void {
    this.musicEnabled = enabled;
    const sampled = this.has('music.battle');
    if (!sampled) {
      this.synthDynamicMusic(enabled, active, isCritical);
      return;
    }
    this.stopMusicLoop();
    this.musicIsCritical = isCritical;
    if (!enabled || !active || this.muted || !this.ctx || document.hidden) {
      this.stopSampleMusic(0.6);
      return;
    }
    if (!this.battleMusic) {
      this.stopMenuMusic(0.4);
      const ctx = this.ctx;
      // both loops start on the same sample so the Critical layer (exactly half the
      // battle loop, same tempo and key) stays bar-aligned forever
      const when = 0.06;
      this.battleMusic = this.startLoop('music.battle', { delay: when, fadeIn: 0.25 });
      if (this.has('music.critical')) {
        this.criticalMusic = this.playSample('music.critical', { loop: true, delay: when, gain: 0 });
        if (this.criticalMusic) this.criticalMusic.gain.gain.setValueAtTime(0, ctx.currentTime);
      }
      this.criticalMix = 0;
    }
    const mix = isCritical ? 1 : 0;
    if (mix !== this.criticalMix && this.ctx) {
      const now = this.ctx.currentTime;
      const base = SOUND_GROUPS['music.battle'].gain;
      const crit = SOUND_GROUPS['music.critical'].gain;
      this.criticalMusic?.gain.gain.setTargetAtTime(mix * crit, now, 0.35);
      // the layer is a full arrangement, so duck the base under it instead of stacking
      this.battleMusic?.gain.gain.setTargetAtTime(base * (mix ? 0.45 : 1), now, 0.35);
      if (mix) this.playCriticalRiser();
      this.criticalMix = mix;
    }
  }

  private stopSampleMusic(fade: number): void {
    this.stopLoop(this.battleMusic, fade);
    this.stopLoop(this.criticalMusic, fade);
    this.battleMusic = null;
    this.criticalMusic = null;
    this.criticalMix = 0;
  }

  public playOutcome(won: boolean): void {
    this.stopMusicLoop();
    this.stopSampleMusic(0.35);
    if (!this.playSample(won ? 'stinger.win' : 'stinger.lose', { delay: 0.12 })) {
      this.synthOutcome(won);
    }
  }

  /** Short synthesized riser when the match enters Critical (kept as synth by design). */
  public playCriticalRiser(): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.9);
      filt.type = 'bandpass';
      filt.Q.value = 3;
      filt.frequency.setValueAtTime(600, now);
      filt.frequency.exponentialRampToValueAtTime(3200, now + 0.9);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.09, now + 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 1.05);
    } catch {
      // Audio context busy
    }
  }

  // ---------------------------------------------------------------------------
  // Weather
  // ---------------------------------------------------------------------------

  private stopAmbBed(fade: number): void {
    if (!this.ambBed) return;
    this.stopLoop(this.ambBed.voice, fade);
    this.ambBed = null;
  }

  public playThunder(): void {
    if (!this.playSample('amb.thunder', { gain: 0.8 + Math.random() * 0.4 })) {
      this.synthDistantThunder();
    }
  }

  // ---------------------------------------------------------------------------
  // Status loops (shield / burn / freeze / overdrive)
  // ---------------------------------------------------------------------------

  public setStatusLoops(active: Iterable<StatusLoopId>): void {
    const want = new Set(this.muted ? [] : active);
    for (const id of STATUS_LOOP_IDS) {
      const voice = this.statusLoops.get(id);
      if (want.has(id) && !voice) {
        const v = this.startLoop(`loop.${id}`, { fadeIn: 0.25 });
        if (v) this.statusLoops.set(id, v);
      } else if (!want.has(id) && voice) {
        this.stopLoop(voice, 0.3);
        this.statusLoops.delete(id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Gameplay one-shots
  // ---------------------------------------------------------------------------

  public playCollision(intensity: number, isCritical = false): void {
    const i = Math.max(0.2, Math.min(1.6, intensity));
    const group = isCritical ? 'impact.top.critical' : i >= 0.75 ? 'impact.top.heavy' : 'impact.top.light';
    const gain = isCritical ? 1 : group === 'impact.top.heavy' ? 0.7 + 0.3 * Math.min(1, (i - 0.75) / 0.6) : 0.55 + 0.45 * (i / 0.75);
    if (this.playSample(group, { gain })) return;
    if (!this.has(group)) this.synthCollision(intensity, isCritical);
  }

  public playWallImpact(intensity: number): void {
    const i = Math.max(0.2, Math.min(1.4, intensity));
    if (this.playSample('impact.wall', { gain: 0.55 + 0.45 * Math.min(1, i) })) return;
    if (!this.has('impact.wall')) this.synthCollision(intensity * 0.65, false);
  }

  public playPillarImpact(intensity: number): void {
    const i = Math.max(0.2, Math.min(1.4, intensity));
    if (this.playSample('impact.pillar', { gain: 0.55 + 0.45 * Math.min(1, i) })) return;
    if (!this.has('impact.pillar')) this.synthCollision(intensity * 0.65, false);
  }

  /** label = ability display name or id ("Flame Burst", "ability.fire.flame_burst"). */
  public playAbility(isUltimate = false, label?: string): void {
    const key = abilitySoundKey(label);
    if (key && this.playSample(key)) return;
    if (key && this.has(key)) return; // voice-limited, not missing
    this.synthAbility(isUltimate);
  }

  public playBurst(): void {
    const ok = this.playSample('finish.burst');
    // debris is a separate layer so the pieces scatter on top of the blast
    this.playSample('finish.debris', { delay: 0.07 });
    if (!ok) this.synthBurst();
  }

  public playRingOut(): void {
    if (!this.playSample('finish.ringout')) this.synthBurst();
  }

  public playSpinOut(): void {
    this.playSample('finish.spinout');
  }

  public playLaunch(): void {
    if (!this.playSample('launch.rip')) this.synthLaunch();
  }

  public playLaunchSlam(power = 0.8): void {
    const p = Math.max(0.3, Math.min(1.3, power));
    if (!this.playSample('launch.land', { gain: 0.6 + 0.4 * Math.min(1, p) })) this.synthLaunchSlam(power);
  }

  public playPerfectLaunch(): void {
    if (!this.playSample('launch.perfect')) this.synthPerfectLaunch();
  }

  public get isAudioInitialized(): boolean {
    return this.unlocked && this.ctx !== null;
  }

  public dispose(): void {
    this.stopMusicLoop();
    this.stopSampleMusic(0.01);
    this.stopMenuMusic(0.01);
    this.stopAmbBed(0.01);
    this.setStatusLoops([]);
    this.buffers.clear();
    this.loadStarted = false;
    this.activeVoices.clear();
    this.lastPlayAt.clear();

    const stopAndDisconnect = (node: AudioScheduledSourceNode | null) => {
      if (!node) return;
      try {
        node.stop();
      } catch {
        // Already stopped or unstarted
      }
      try {
        node.disconnect();
      } catch {
        // Already disconnected
      }
    };

    const disconnectNode = (node: AudioNode | null) => {
      if (!node) return;
      try {
        node.disconnect();
      } catch {
        // Already disconnected
      }
    };

    stopAndDisconnect(this.spinOsc1);
    stopAndDisconnect(this.spinOsc2);
    stopAndDisconnect(this.weatherLfo);
    stopAndDisconnect(this.weatherNoiseSource);

    disconnectNode(this.spinFilter);
    disconnectNode(this.spinGain);
    disconnectNode(this.weatherLfoGain);
    disconnectNode(this.weatherFilter);
    disconnectNode(this.weatherGain);
    disconnectNode(this.sfxBus);
    disconnectNode(this.musicBus);
    disconnectNode(this.ambBus);
    disconnectNode(this.masterGain);
    this.sfxBus = null;
    this.musicBus = null;
    this.ambBus = null;

    this.spinOsc1 = null;
    this.spinOsc2 = null;
    this.spinFilter = null;
    this.spinGain = null;
    this.weatherLfo = null;
    this.weatherLfoGain = null;
    this.weatherNoiseSource = null;
    this.weatherFilter = null;
    this.weatherGain = null;
    this.masterGain = null;
    this.sparkNoiseBuffer = null;

    if (this.ctx) {
      const ctxToClose = this.ctx;
      this.ctx = null;
      if (ctxToClose.state !== 'closed') {
        void ctxToClose.close().catch(() => {
          // Ignore close errors
        });
      }
    }

    this.unlocked = false;
    this.weatherActive = false;
    this.currentWeather = 'Clear';
    this.weatherGustTime = 0;
    this.weatherParamThrottleTimer = 0;
    this.musicStep = 0;
    this.musicIsCritical = false;
  }
}

export const soundEngine = new SpinSoundEngine();
