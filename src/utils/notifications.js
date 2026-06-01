const fallbackNotificationSettings = {
  notificationsEnabled: true,
  desktopNotificationsEnabled: true,
  notificationSoundEnabled: true,
  notificationSoundPath: '',
};

function toFileUrl(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replaceAll('\\', '/');
  return encodeURI(`file:///${normalized.replace(/^\/+/, '')}`);
}

function playFallbackTone(type = 'info') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies = {
      success: 740,
      warning: 520,
      error: 220,
      info: 640,
    };

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequencies[type] ?? frequencies.info, context.currentTime);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Sound is best effort; browsers can block playback until user interaction.
  }
}

async function readNotificationSettings() {
  if (!window.api?.getAppSettings) return fallbackNotificationSettings;

  try {
    const result = await window.api.getAppSettings();
    return {
      ...fallbackNotificationSettings,
      ...(result?.settings ?? {}),
    };
  } catch {
    return fallbackNotificationSettings;
  }
}

export async function notifyUser({
  type = 'info',
  title,
  message,
  sound = true,
  desktop = true,
  settings: settingsOverride,
} = {}) {
  const settings = {
    ...fallbackNotificationSettings,
    ...(settingsOverride ?? await readNotificationSettings()),
  };
  if (!settings.notificationsEnabled) return { ok: false, mode: 'disabled' };

  if (desktop && settings.desktopNotificationsEnabled && window.api?.showNotification) {
    window.api.showNotification({
      title,
      body: message,
      type,
    }).catch(() => {});
  }

  if (sound && settings.notificationSoundEnabled) {
    if (settings.notificationSoundPath) {
      try {
        const audio = new Audio(toFileUrl(settings.notificationSoundPath));
        audio.volume = 0.65;
        await audio.play();
      } catch {
        playFallbackTone(type);
      }
    } else {
      playFallbackTone(type);
    }
  }

  return { ok: true };
}
