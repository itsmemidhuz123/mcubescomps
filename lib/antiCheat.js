// Anti-Cheat Detection System for MCUBES Competition Platform
// Only activates during inspection and solve phases

export class AntiCheatDetector {
  constructor() {
    this.violations = {
      tabSwitch: false,
      windowBlur: false,
      multiTab: false,
      rightClick: false,
      devTools: false,
      pageRefresh: false,
      suspiciousTime: false
    };
    this.flagReasons = [];
    this.anomalyScore = 0;
    this.isActive = false;
    this.listeners = [];
  }

  // Activate anti-cheat (called when inspection or solve starts)
  activate() {
    if (this.isActive) return;
    this.isActive = true;
    this.setupListeners();
    this.startMultiTabDetection();
    this.startDevToolsDetection();
  }

  // Deactivate anti-cheat (called when solve completes)
  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    this.removeListeners();
    this.stopMultiTabDetection();
    this.stopDevToolsDetection();
  }

  // Setup all event listeners
  setupListeners() {
    // Tab Switch / Visibility Detection
    const visibilityHandler = () => {
      if (document.hidden && this.isActive) {
        this.violations.tabSwitch = true;
        this.addFlagReason('TAB_SWITCH_DETECTED');
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    this.listeners.push({ type: 'visibilitychange', handler: visibilityHandler, target: document });

    // Window Blur Detection
    const blurHandler = () => {
      if (this.isActive) {
        this.violations.windowBlur = true;
        this.addFlagReason('WINDOW_BLUR_DETECTED');
      }
    };
    window.addEventListener('blur', blurHandler);
    this.listeners.push({ type: 'blur', handler: blurHandler, target: window });

    // Right Click Protection
    const contextMenuHandler = (e) => {
      if (this.isActive) {
        e.preventDefault();
        this.violations.rightClick = true;
        this.addFlagReason('RIGHT_CLICK_DETECTED');
      }
    };
    document.addEventListener('contextmenu', contextMenuHandler);
    this.listeners.push({ type: 'contextmenu', handler: contextMenuHandler, target: document });

    // Keyboard Shortcut Detection (DevTools)
    const keydownHandler = (e) => {
      if (!this.isActive) return;
      
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_KEYBOARD_ATTEMPT');
      }
      
      // Ctrl+Shift+I (Inspect)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
        e.preventDefault();
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_KEYBOARD_ATTEMPT');
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
        e.preventDefault();
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_KEYBOARD_ATTEMPT');
      }
      
      // Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.keyCode === 67)) {
        e.preventDefault();
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_KEYBOARD_ATTEMPT');
      }
      
      // Cmd+Option+I (Mac)
      if (e.metaKey && e.altKey && (e.key === 'I' || e.keyCode === 73)) {
        e.preventDefault();
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_KEYBOARD_ATTEMPT');
      }
      
      // Cmd+Option+J (Mac)
      if (e.metaKey && e.altKey && (e.key === 'J' || e.keyCode === 74)) {
        e.preventDefault();
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_KEYBOARD_ATTEMPT');
      }
    };
    document.addEventListener('keydown', keydownHandler);
    this.listeners.push({ type: 'keydown', handler: keydownHandler, target: document });

    // Page Unload Detection (Refresh/Close)
    const beforeUnloadHandler = (e) => {
      if (this.isActive) {
        this.violations.pageRefresh = true;
        this.addFlagReason('PAGE_REFRESH_DETECTED');
        // Store violation in sessionStorage for recovery
        sessionStorage.setItem('antiCheatRefreshViolation', JSON.stringify({
          timestamp: Date.now(),
          violations: this.violations,
          flagReasons: this.flagReasons
        }));
      }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    this.listeners.push({ type: 'beforeunload', handler: beforeUnloadHandler, target: window });
  }

  // Remove all event listeners
  removeListeners() {
    this.listeners.forEach(({ type, handler, target }) => {
      target.removeEventListener(type, handler);
    });
    this.listeners = [];
  }

  // Multi-Tab Detection using BroadcastChannel
  startMultiTabDetection() {
    try {
      // Check if BroadcastChannel is supported
      if (typeof BroadcastChannel !== 'undefined') {
        this.tabChannel = new BroadcastChannel('mcubes_competition_tab');
        
        // Listen for other tabs
        this.tabChannel.onmessage = (event) => {
          if (event.data.type === 'TAB_ACTIVE' && this.isActive) {
            this.violations.multiTab = true;
            this.addFlagReason('MULTIPLE_TABS_DETECTED');
          }
        };
        
        // Announce this tab is active
        this.tabChannel.postMessage({ type: 'TAB_ACTIVE', timestamp: Date.now() });
        
        // Send periodic heartbeats
        this.tabHeartbeat = setInterval(() => {
          if (this.isActive && this.tabChannel) {
            this.tabChannel.postMessage({ type: 'TAB_ACTIVE', timestamp: Date.now() });
          }
        }, 2000);
      } else {
        // Fallback to localStorage for older browsers
        const tabId = `tab_${Date.now()}_${Math.random()}`;
        const checkOtherTabs = () => {
          if (!this.isActive) return;
          
          const activeTabs = JSON.parse(localStorage.getItem('mcubes_active_tabs') || '[]');
          const now = Date.now();
          
          // Clean old tabs (older than 5 seconds)
          const recentTabs = activeTabs.filter(t => now - t.timestamp < 5000);
          
          // Check if there are other active tabs
          if (recentTabs.length > 0 && !recentTabs.some(t => t.id === tabId)) {
            this.violations.multiTab = true;
            this.addFlagReason('MULTIPLE_TABS_DETECTED');
          }
          
          // Add this tab
          recentTabs.push({ id: tabId, timestamp: now });
          localStorage.setItem('mcubes_active_tabs', JSON.stringify(recentTabs));
        };
        
        this.tabHeartbeat = setInterval(checkOtherTabs, 2000);
        checkOtherTabs();
      }
    } catch (e) {
      console.error('Multi-tab detection error:', e);
    }
  }

  stopMultiTabDetection() {
    if (this.tabChannel) {
      this.tabChannel.close();
      this.tabChannel = null;
    }
    if (this.tabHeartbeat) {
      clearInterval(this.tabHeartbeat);
      this.tabHeartbeat = null;
    }
  }

  // DevTools Detection (Heuristic)
  startDevToolsDetection() {
    // Skip on mobile devices
    if (this.isMobileDevice()) return;
    
    // Window size detection
    const checkWindowSize = () => {
      if (!this.isActive) return;
      
      const widthThreshold = window.outerWidth - window.innerWidth;
      const heightThreshold = window.outerHeight - window.innerHeight;
      
      // DevTools typically adds 160+ pixels to dimensions
      if (widthThreshold > 160 || heightThreshold > 200) {
        this.violations.devTools = true;
        this.addFlagReason('DEVTOOLS_OPENED');
      }
    };
    
    this.devToolsInterval = setInterval(checkWindowSize, 1000);
    checkWindowSize();
  }

  stopDevToolsDetection() {
    if (this.devToolsInterval) {
      clearInterval(this.devToolsInterval);
      this.devToolsInterval = null;
    }
  }

  // Check for suspicious time patterns
  checkSuspiciousTime(timeMs, previousTimes = []) {
    if (!timeMs || timeMs < 0) return false;
    
    // Flag if time is impossibly fast (< 1 second)
    if (timeMs < 1000) {
      this.violations.suspiciousTime = true;
      this.addFlagReason('IMPOSSIBLE_TIME_UNDER_1S');
      this.anomalyScore += 50;
      return true;
    }
    
    // Check for unrealistic improvement
    if (previousTimes.length > 0) {
      const validPreviousTimes = previousTimes.filter(t => t && t !== Infinity && t > 0);
      
      if (validPreviousTimes.length > 0) {
        const avgPrevious = validPreviousTimes.reduce((a, b) => a + b, 0) / validPreviousTimes.length;
        const improvement = ((avgPrevious - timeMs) / avgPrevious) * 100;
        
        // Flag if improvement is > 70% suddenly
        if (improvement > 70 && avgPrevious > 10000) {
          this.violations.suspiciousTime = true;
          this.addFlagReason(`SUSPICIOUS_IMPROVEMENT_${Math.round(improvement)}%`);
          this.anomalyScore += 30;
          return true;
        }
      }
    }
    
    return false;
  }

  // Check if page was refreshed during solve
  checkForRefreshViolation() {
    const stored = sessionStorage.getItem('antiCheatRefreshViolation');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // If refresh happened within last 30 seconds, consider it during solve
        if (Date.now() - data.timestamp < 30000) {
          this.violations = { ...this.violations, ...data.violations };
          this.flagReasons = [...this.flagReasons, ...data.flagReasons];
          sessionStorage.removeItem('antiCheatRefreshViolation');
          return true;
        }
      } catch (e) {
        console.error('Error parsing refresh violation:', e);
      }
      sessionStorage.removeItem('antiCheatRefreshViolation');
    }
    return false;
  }

  // Add a flag reason (avoid duplicates)
  addFlagReason(reason) {
    if (!this.flagReasons.includes(reason)) {
      this.flagReasons.push(reason);
      this.anomalyScore += 10;
    }
  }

  // Check if device is mobile
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Get final violation report
  getViolationReport() {
    return {
      flagged: this.isFlagged(),
      violations: this.violations,
      flagReasons: this.flagReasons,
      anomalyScore: this.anomalyScore
    };
  }

  // Check if any violations occurred
  isFlagged() {
    return Object.values(this.violations).some(v => v === true) || this.flagReasons.length > 0;
  }

  // Reset all violations
  reset() {
    this.violations = {
      tabSwitch: false,
      windowBlur: false,
      multiTab: false,
      rightClick: false,
      devTools: false,
      pageRefresh: false,
      suspiciousTime: false
    };
    this.flagReasons = [];
    this.anomalyScore = 0;
  }
}

// Device Fingerprinting
export function getDeviceFingerprint() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    deviceMemory: navigator.deviceMemory || null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    plugins: Array.from(navigator.plugins || []).map(p => p.name).join(', '),
    canvas: getCanvasFingerprint()
  };
}

// Canvas fingerprinting for additional device identification
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('MCUBES 🎲', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Security', 4, 17);
    
    return canvas.toDataURL().slice(-50); // Last 50 chars as fingerprint
  } catch (e) {
    return null;
  }
}

// IP Address fetching utility
export async function getUserIP() {
  try {
    const response = await fetch('/api/get-ip');
    const data = await response.json();
    return {
      ip: data.ip || 'unknown',
      country: data.country || 'unknown',
      city: data.city || 'unknown'
    };
  } catch (error) {
    console.error('Failed to get IP:', error);
    return { ip: 'unknown', country: 'unknown', city: 'unknown' };
  }
}