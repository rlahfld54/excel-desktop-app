const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const cloudConfig = {
  apiBaseUrl: (import.meta.env.VITE_SHARED_API_BASE_URL ?? '').replace(/\/$/, ''),
  apiKey: import.meta.env.VITE_SHARED_API_KEY ?? '',
  pollingIntervalMs: numberFromEnv(import.meta.env.VITE_SHARED_POLLING_INTERVAL_MS, 60000),
  apiTimeoutMs: numberFromEnv(import.meta.env.VITE_SHARED_API_TIMEOUT_MS, 15000),
  backupBucket: import.meta.env.VITE_SHARED_BACKUP_BUCKET ?? '',
  backupRegion: import.meta.env.VITE_SHARED_BACKUP_REGION ?? 'ap-northeast-2',
};

export function isSharedApiEnabled() {
  return Boolean(cloudConfig.apiBaseUrl);
}
