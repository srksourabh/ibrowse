/**
 * iBrowse — Tactile & Audio Desktop Accessibility System
 * Multimodal interaction engine for completely blind users
 * Combining:
 *  - Spatial Pointer Tracking (Mouse & Touchscreen)
 *  - Affordance & Interactivity Engine ("Clickable" vs "Text only")
 *  - Word-by-Word Scroll Wheel Scrubbing
 *  - Real-time Haptic Actuator Driver & Acoustic Haptic Waveform Simulator
 *  - Spatial Audio Panning & Ultra-Low Latency Speech Synthesizer
 *  - Taskbar Status Monitor
 */

class IBrowseSystem {
  constructor() {
    // Audio & Speech Subsystem
    this.audioCtx = null;
    this.speechSynth = window.speechSynthesis;
    this.isAudioReady = false;
    this.pannerNode = null;
    this.speechRate = 1.2;
    this.speechPitch = 1.0;
    this.hapticIntensity = 0.85; // 0.0 - 1.0
    this.verbosityMode = 'full'; // 'full' (spoken) or 'earcons'
    this.spatialPanEnabled = true;

    // Pointer & Spatial Tracking
    this.currentPointerX = 0;
    this.currentPointerY = 0;
    this.lastHoveredElement = null;
    this.hoverDwellTimer = null;
    this.lastSpokenText = '';
    this.isInsideTaskbar = false;

    // Word Scrubbing Engine
    this.activeTextContainer = null;
    this.tokenizedWords = [];
    this.currentWordIndex = -1;

    // Haptic Waveform Visualizer
    this.hapticCanvas = document.getElementById('haptic-canvas');
    this.hapticCanvasCtx = this.hapticCanvas ? this.hapticCanvas.getContext('2d') : null;
    this.waveformBuffer = new Array(120).fill(0);
    this.animFrameId = null;

    // DOM Elements
    this.telemetrySpeech = document.getElementById('telemetry-speech-text');
    this.dispTargetTag = document.getElementById('disp-target-tag');
    this.dispAffordanceState = document.getElementById('disp-affordance-state');
    this.dispCoords = document.getElementById('disp-coords');
    this.dispAudioPan = document.getElementById('disp-audio-pan');
    this.dispActiveWord = document.getElementById('disp-active-word');
    this.affordanceBadge = document.getElementById('telemetry-affordance-badge');
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.blindCurtain = document.getElementById('blind-simulation-curtain');

    this.initClock();
  }

  /* ==========================================================================
     1. Initialization & Audio Subsystem
     ========================================================================== */
  async initAudioContext() {
    if (this.isAudioReady) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Create Stereo Panner Node for spatial horizontal audio
      if (this.audioCtx.createStereoPanner) {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.connect(this.audioCtx.destination);
      }

      this.isAudioReady = true;

      // Update HUD
      const audioStatus = document.getElementById('hud-audio-status');
      if (audioStatus) {
        audioStatus.innerHTML = '<span class="status-indicator active"></span> Audio Engine: Active';
      }

      this.startWaveformAnimation();
      this.playChimeSuccess();
      this.speak("iBrowse Accessibility System initialized. Move mouse or touch screen to explore.", true);
    } catch (e) {
      console.warn("AudioContext initialization error:", e);
    }
  }

  /* ==========================================================================
     2. Spatial Audio & Low-Latency Earcons
     ========================================================================== */
  getPanFromCoordinate(x) {
    if (!this.spatialPanEnabled) return 0;
    const width = window.innerWidth || 1920;
    // Map X coordinate from [0, width] to stereo pan [-0.85, +0.85]
    const normalized = (x / width) * 2 - 1;
    return Math.max(-0.85, Math.min(0.85, normalized));
  }

  playEarcon(freq, type = 'sine', duration = 0.08, gainVal = 0.2, pan = 0) {
    if (!this.isAudioReady || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      if (this.pannerNode && this.audioCtx.createStereoPanner) {
        const localPanner = this.audioCtx.createStereoPanner();
        localPanner.pan.setValueAtTime(pan, now);
        osc.connect(gain);
        gain.connect(localPanner);
        localPanner.connect(this.audioCtx.destination);
      } else {
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
      }

      osc.start(now);
      osc.stop(now + duration);
    } catch (err) {
      console.error(err);
    }
  }

  // Double high chime for clickable interactive elements
  playClickableEarcon(pan) {
    this.playEarcon(540, 'triangle', 0.04, 0.22, pan);
    setTimeout(() => {
      this.playEarcon(820, 'triangle', 0.06, 0.28, pan);
    }, 35);
  }

  // Soft low click for static text
  playTextEarcon(pan) {
    this.playEarcon(220, 'sine', 0.035, 0.14, pan);
  }

  // Crisp mechanical detent click for word-by-word scroll scrubbing
  playWordTickEarcon(pan) {
    this.playEarcon(280, 'triangle', 0.02, 0.35 * this.hapticIntensity, pan);
    // Sub-bass physical acoustic haptic impulse
    this.playEarcon(80, 'sine', 0.04, 0.45 * this.hapticIntensity, pan);
  }

  // Thud for end/start of paragraph or screen boundaries
  playBoundaryBumperEarcon(pan) {
    this.playEarcon(95, 'sawtooth', 0.08, 0.35, pan);
    setTimeout(() => {
      this.playEarcon(75, 'sine', 0.06, 0.3, pan);
    }, 40);
  }

  // Pleasant welcome chime
  playChimeSuccess() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playEarcon(freq, 'sine', 0.12, 0.15, 0), idx * 60);
    });
  }

  /* ==========================================================================
     3. Haptic Actuation & Live Waveform Simulation
     ========================================================================== */
  triggerHapticPulse(type) {
    // 1. Device Vibration API (Mobile / Haptic Gamepad / Supported Browsers)
    if (navigator.vibrate) {
      try {
        if (type === 'clickable') {
          navigator.vibrate([22, 15, 22]); // Double snap
        } else if (type === 'text') {
          navigator.vibrate([10]); // Subtle brush
        } else if (type === 'word_tick') {
          navigator.vibrate([8]); // Sharp detent
        } else if (type === 'boundary') {
          navigator.vibrate([40, 20, 30]); // Bump
        }
      } catch (e) {
        // Ignored
      }
    }

    // 2. Feed tactile waveform buffer for canvas monitor
    this.injectWaveformImpulse(type);
  }

  injectWaveformImpulse(type) {
    const scale = this.hapticIntensity;
    let pattern = [];
    if (type === 'clickable') {
      pattern = [0.8, -0.7, 0.6, -0.4, 0.2, 0, 0.9, -0.8, 0.7, -0.5, 0.3];
    } else if (type === 'text') {
      pattern = [0.4, -0.3, 0.2, -0.1];
    } else if (type === 'word_tick') {
      pattern = [1.0, -0.9, 0.8, -0.5, 0.3, -0.1];
    } else if (type === 'boundary') {
      pattern = [0.9, -0.8, 0.9, -0.8, 0.6, -0.5, 0.3];
    }

    pattern.forEach((val) => {
      this.waveformBuffer.push(val * scale);
      if (this.waveformBuffer.length > 120) {
        this.waveformBuffer.shift();
      }
    });
  }

  startWaveformAnimation() {
    if (!this.hapticCanvasCtx) return;
    const canvas = this.hapticCanvas;
    const ctx = this.hapticCanvasCtx;

    const render = () => {
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center baseline
      const midY = canvas.height / 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(canvas.width, midY);
      ctx.stroke();

      // Draw Haptic Waveform
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const stepX = canvas.width / this.waveformBuffer.length;

      for (let i = 0; i < this.waveformBuffer.length; i++) {
        const x = i * stepX;
        const val = this.waveformBuffer[i];
        const y = midY - val * (midY * 0.85);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Decay buffer naturally
      for (let i = 0; i < this.waveformBuffer.length; i++) {
        this.waveformBuffer[i] *= 0.93;
        if (Math.abs(this.waveformBuffer[i]) < 0.005) {
          this.waveformBuffer[i] = 0;
        }
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    render();
  }

  /* ==========================================================================
     4. Speech Synthesis & Vocal Queue Management
     ========================================================================== */
  speak(text, priority = false) {
    if (!text || text.trim() === '') return;
    if (!this.speechSynth) return;

    if (this.telemetrySpeech) {
      this.telemetrySpeech.textContent = text;
    }

    // Always interrupt previous speech immediately on new hover / scrubbing
    if (this.speechSynth.speaking || priority) {
      this.speechSynth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.speechRate;
    utterance.pitch = this.speechPitch;

    // Pick best available English voice
    const voices = this.speechSynth.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    this.speechSynth.speak(utterance);
    this.lastSpokenText = text;
  }

  /* ==========================================================================
     5. Affordance & Interactivity Engine ("Clickable" vs "Text only")
     ========================================================================== */
  analyzeElement(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }

    // Ascend to meaningful interactive parent if inside a button, link, or label
    let target = el.closest('button, a, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], .desktop-icon-item, .taskbar-btn, .tray-icon, .tray-clock');
    if (!target) {
      target = el;
    }

    const tag = target.tagName.toLowerCase();
    const role = target.getAttribute('role');
    const ariaLabel = target.getAttribute('aria-label');
    const title = target.getAttribute('title');

    // 1. Determine Interactivity (Clickable vs Static Text)
    const isClickable = (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      role === 'button' ||
      role === 'link' ||
      role === 'checkbox' ||
      target.classList.contains('desktop-icon-item') ||
      target.classList.contains('taskbar-btn') ||
      target.classList.contains('tray-icon') ||
      target.classList.contains('tray-clock') ||
      target.classList.contains('win-btn') ||
      window.getComputedStyle(target).cursor === 'pointer'
    );

    // 2. Determine Role Label
    let roleLabel = 'Text';
    if (tag === 'button' || role === 'button') roleLabel = 'Button';
    else if (tag === 'a' || role === 'link') roleLabel = 'Link';
    else if (tag === 'input') {
      const type = target.getAttribute('type') || 'text';
      roleLabel = type === 'checkbox' ? 'Checkbox' : 'Input field';
    }
    else if (tag.startsWith('h') && tag.length === 2) {
      roleLabel = `Heading level ${tag[1]}`;
    } else if (tag === 'p') {
      roleLabel = 'Paragraph';
    } else if (target.classList.contains('desktop-icon-item')) {
      roleLabel = 'Desktop Icon';
    } else if (target.classList.contains('taskbar-btn')) {
      roleLabel = 'Taskbar Item';
    }

    // 3. Determine Accessible Text
    let labelText = ariaLabel || title || '';
    if (!labelText) {
      if (tag === 'input') {
        labelText = target.placeholder || target.value || 'Text entry';
      } else {
        labelText = target.innerText ? target.innerText.trim().slice(0, 120) : '';
      }
    }

    // Clean whitespace
    labelText = labelText.replace(/\s+/g, ' ');

    return {
      element: target,
      tag: tag,
      role: roleLabel,
      isClickable: isClickable,
      label: labelText,
      fullAnnouncement: isClickable
        ? `${labelText ? labelText + ' — ' : ''}${roleLabel}, Clickable`
        : `${labelText ? labelText + ' — ' : ''}${roleLabel}, Text only`
    };
  }

  /* ==========================================================================
     6. Spatial Pointer Tracking (Mouse Hover & Touch Exploration)
     ========================================================================== */
  handlePointerMove(clientX, clientY) {
    this.currentPointerX = clientX;
    this.currentPointerY = clientY;

    // Spatial Audio Pan Calculation
    const pan = this.getPanFromCoordinate(clientX);
    if (this.dispAudioPan) {
      this.dispAudioPan.textContent = pan < -0.1 ? `Left (${pan.toFixed(2)})` : pan > 0.1 ? `Right (+${pan.toFixed(2)})` : `Center (${pan.toFixed(2)})`;
    }
    if (this.dispCoords) {
      this.dispCoords.textContent = `X: ${Math.round(clientX)}px, Y: ${Math.round(clientY)}px`;
    }

    // Check Taskbar Zone Collision
    const windowHeight = window.innerHeight || 1080;
    const inTaskbarZone = clientY >= windowHeight - 56;
    if (inTaskbarZone && !this.isInsideTaskbar) {
      this.isInsideTaskbar = true;
      this.triggerHapticPulse('clickable');
      this.playEarcon(320, 'sine', 0.05, 0.2, pan);
    } else if (!inTaskbarZone && this.isInsideTaskbar) {
      this.isInsideTaskbar = false;
    }

    // Resolve element under pointer
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || el === this.lastHoveredElement) return;

    // Clear previous visual hover ring
    if (this.lastHoveredElement) {
      this.lastHoveredElement.classList.remove('spatial-hover-ring', 'clickable-ring');
    }

    const info = this.analyzeElement(el);
    if (!info) return;

    this.lastHoveredElement = info.element;

    // Apply visual focus ring
    info.element.classList.add('spatial-hover-ring');
    if (info.isClickable) {
      info.element.classList.add('clickable-ring');
    }

    // Prepare text container for scroll-scrubbing if applicable
    this.prepareTextContainer(info.element);

    // Update Telemetry Display
    if (this.dispTargetTag) this.dispTargetTag.textContent = `<${info.tag}> ${info.role}`;
    if (this.dispAffordanceState) this.dispAffordanceState.textContent = info.isClickable ? 'Clickable' : 'Text only';
    if (this.affordanceBadge) {
      this.affordanceBadge.textContent = info.isClickable ? 'CLICKABLE' : 'TEXT ONLY';
      this.affordanceBadge.className = `widget-badge ${info.isClickable ? 'clickable' : 'text-only'}`;
    }

    // Debounce hover dwell before speaking to avoid sound cacophony while sweeping cursor
    clearTimeout(this.hoverDwellTimer);
    this.hoverDwellTimer = setTimeout(() => {
      // Trigger Haptic Feedback
      this.triggerHapticPulse(info.isClickable ? 'clickable' : 'text');

      // Trigger Audio Earcon
      if (info.isClickable) {
        this.playClickableEarcon(pan);
      } else {
        this.playTextEarcon(pan);
      }

      // Trigger Speech
      if (this.verbosityMode === 'full') {
        this.speak(info.fullAnnouncement);
      } else {
        // Earcon mode: speak only the label
        this.speak(info.label);
      }
    }, 70); // 70ms responsiveness
  }

  /* ==========================================================================
     7. Word-by-Word Mouse Scroll Wheel Scrubbing Engine
     ========================================================================== */
  prepareTextContainer(el) {
    const textTarget = el.closest('p, h1, h2, h3, h4, .alert-content, .card-subtitle');
    if (!textTarget) {
      this.activeTextContainer = null;
      this.tokenizedWords = [];
      this.currentWordIndex = -1;
      if (this.dispActiveWord) this.dispActiveWord.textContent = '—';
      return;
    }

    if (this.activeTextContainer === textTarget) return;

    this.activeTextContainer = textTarget;

    // Tokenize text into individual word spans if not already tokenized
    if (!textTarget.dataset.tokenized) {
      const originalText = textTarget.innerText;
      const words = originalText.split(/(\s+)/); // keep whitespace
      textTarget.innerHTML = '';

      words.forEach((chunk) => {
        if (chunk.trim().length > 0) {
          const span = document.createElement('span');
          span.className = 'ibrowse-word-token';
          span.textContent = chunk;
          textTarget.appendChild(span);
        } else {
          textTarget.appendChild(document.createTextNode(chunk));
        }
      });
      textTarget.dataset.tokenized = 'true';
    }

    this.tokenizedWords = Array.from(textTarget.querySelectorAll('.ibrowse-word-token'));
    this.currentWordIndex = 0;
  }

  handleWheelScrub(event) {
    if (!this.activeTextContainer || this.tokenizedWords.length === 0) {
      return; // Regular scroll if outside text
    }

    // Intercept wheel event for granular word reading
    event.preventDefault();

    const isScrollingDown = event.deltaY > 0;
    const prevIndex = this.currentWordIndex;

    if (isScrollingDown) {
      if (this.currentWordIndex < this.tokenizedWords.length - 1) {
        this.currentWordIndex++;
      } else {
        // Reached end of paragraph: boundary bumper!
        this.triggerHapticPulse('boundary');
        this.playBoundaryBumperEarcon(this.getPanFromCoordinate(this.currentPointerX));
        this.speak("End of paragraph", true);
        return;
      }
    } else {
      if (this.currentWordIndex > 0) {
        this.currentWordIndex--;
      } else {
        // Reached start of paragraph: boundary bumper!
        this.triggerHapticPulse('boundary');
        this.playBoundaryBumperEarcon(this.getPanFromCoordinate(this.currentPointerX));
        this.speak("Start of paragraph", true);
        return;
      }
    }

    // Remove active highlight from previous word
    if (this.tokenizedWords[prevIndex]) {
      this.tokenizedWords[prevIndex].classList.remove('word-scrub-active');
    }

    // Highlight and pronounce new word
    const activeSpan = this.tokenizedWords[this.currentWordIndex];
    if (activeSpan) {
      activeSpan.classList.add('word-scrub-active');
      const wordText = activeSpan.textContent.trim().replace(/[.,!?;:"()]/g, '');

      // Trigger Haptics & Acoustic Word Tick
      const pan = this.getPanFromCoordinate(this.currentPointerX);
      this.triggerHapticPulse('word_tick');
      this.playWordTickEarcon(pan);

      // Update Telemetry
      if (this.dispActiveWord) {
        this.dispActiveWord.textContent = wordText;
      }

      // Pronounce the single word immediately
      this.speak(wordText);
    }
  }

  /* ==========================================================================
     8. Clock & System Utilities
     ========================================================================== */
  initClock() {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;

      const elTime = document.getElementById('clock-time');
      const elDate = document.getElementById('clock-date');
      const trayClock = document.getElementById('tray-clock');

      if (elTime) elTime.textContent = timeStr;
      if (elDate) elDate.textContent = dateStr;
      if (trayClock) {
        trayClock.setAttribute('aria-label', `System Clock: ${timeStr}, ${dateStr}, Clickable`);
      }
    };
    updateTime();
    setInterval(updateTime, 30000);
  }
}

/* ==========================================================================
   DOM Event Listeners & System Startup
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const ibrowse = new IBrowseSystem();

  // 1. Audio Startup Modal Handler
  const btnStart = document.getElementById('btn-start-system');
  const initModal = document.getElementById('audio-init-modal');

  const startAudioEngine = async () => {
    await ibrowse.initAudioContext();
    if (initModal) initModal.classList.add('hidden');
  };

  if (btnStart) {
    btnStart.addEventListener('click', startAudioEngine);
  }

  // Also auto-init on first page interaction if modal is clicked
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      startAudioEngine();
    }
  }, { once: true });

  // 2. Mouse Movement Tracking
  window.addEventListener('mousemove', (e) => {
    ibrowse.handlePointerMove(e.clientX, e.clientY);
  });

  // 3. Touch Exploration Tracking (Direct Touchscreen exploration)
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      ibrowse.handlePointerMove(touch.clientX, touch.clientY);
    }
  }, { passive: true });

  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      ibrowse.handlePointerMove(touch.clientX, touch.clientY);
    }
  }, { passive: true });

  // 4. Word-by-Word Scrollwheel Scrubbing
  window.addEventListener('wheel', (e) => {
    ibrowse.handleWheelScrub(e);
  }, { passive: false });

  // 5. Blind Simulation Mode Toggle
  const btnBlindToggle = document.getElementById('btn-toggle-blind-mode');
  const btnExitBlind = document.getElementById('btn-exit-blind-mode');
  const curtain = document.getElementById('blind-simulation-curtain');

  const toggleBlind = () => {
    const isHidden = curtain.classList.contains('hidden');
    if (isHidden) {
      curtain.classList.remove('hidden');
      ibrowse.speak("Blind exploration simulation activated. Visual display darkened.");
    } else {
      curtain.classList.add('hidden');
      ibrowse.speak("Blind exploration simulation deactivated.");
    }
  };

  if (btnBlindToggle) btnBlindToggle.addEventListener('click', toggleBlind);
  if (btnExitBlind) btnExitBlind.addEventListener('click', toggleBlind);

  // 6. Settings Panel Drawer
  const btnSettings = document.getElementById('btn-toggle-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const drawer = document.getElementById('settings-drawer');

  if (btnSettings && drawer) {
    btnSettings.addEventListener('click', () => drawer.classList.toggle('hidden'));
  }
  if (btnCloseSettings && drawer) {
    btnCloseSettings.addEventListener('click', () => drawer.classList.add('hidden'));
  }

  // Speech Rate & Pitch Sliders
  const rangeRate = document.getElementById('range-speech-rate');
  const valRate = document.getElementById('val-speech-rate');
  if (rangeRate) {
    rangeRate.addEventListener('input', (e) => {
      ibrowse.speechRate = parseFloat(e.target.value);
      if (valRate) valRate.textContent = `${ibrowse.speechRate.toFixed(1)}x`;
    });
  }

  const rangePitch = document.getElementById('range-speech-pitch');
  const valPitch = document.getElementById('val-speech-pitch');
  if (rangePitch) {
    rangePitch.addEventListener('input', (e) => {
      ibrowse.speechPitch = parseFloat(e.target.value);
      if (valPitch) valPitch.textContent = `${ibrowse.speechPitch.toFixed(1)}`;
    });
  }

  const rangeHaptics = document.getElementById('range-haptic-strength');
  const valHaptics = document.getElementById('val-haptic-strength');
  if (rangeHaptics) {
    rangeHaptics.addEventListener('input', (e) => {
      ibrowse.hapticIntensity = parseInt(e.target.value, 10) / 100;
      if (valHaptics) valHaptics.textContent = `${e.target.value}%`;
    });
  }

  const chkSpatial = document.getElementById('chk-spatial-pan');
  if (chkSpatial) {
    chkSpatial.addEventListener('change', (e) => {
      ibrowse.spatialPanEnabled = e.target.checked;
    });
  }

  document.querySelectorAll('input[name="verbosity"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      ibrowse.verbosityMode = e.target.value;
    });
  });

  // 7. Interactive Form Demo Buttons
  const btnSubmit = document.getElementById('btn-submit-survey');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      ibrowse.triggerHapticPulse('clickable');
      ibrowse.playChimeSuccess();
      ibrowse.speak("Survey response submitted successfully. Thank you!");
    });
  }

  const btnReset = document.getElementById('btn-reset-form');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      ibrowse.triggerHapticPulse('clickable');
      ibrowse.speak("Form controls reset to defaults.");
    });
  }

  const btnDismissAlert = document.getElementById('btn-dismiss-alert');
  const alertBanner = document.getElementById('tip-wheel-scrub');
  if (btnDismissAlert && alertBanner) {
    btnDismissAlert.addEventListener('click', () => {
      alertBanner.style.display = 'none';
      ibrowse.speak("Feature tip banner dismissed.");
    });
  }
});
