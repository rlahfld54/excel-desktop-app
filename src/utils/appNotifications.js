import { isSharedApiEnabled } from '../config/cloud';
import { sharedDataService } from '../services/sharedDataService';

export const notificationChangedEvent = 'excel-workspace:notifications-changed';
let notificationCache = [];

function normalizeNotification(notification) {
  return {
    id: String(notification.id ?? notification.clientId ?? notification.dbId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: notification.title ?? '알림',
    message: notification.message ?? '',
    level: notification.level ?? 'INFO',
    target: notification.target ?? '',
    href: notification.href ?? '',
    read: Boolean(notification.read),
    createdAt: notification.createdAt ?? new Date().toISOString(),
    readAt: notification.readAt ?? null,
  };
}

function readStoredNotifications() {
  return notificationCache;
}

function writeStoredNotifications(notifications) {
  notificationCache = notifications.map(normalizeNotification).slice(0, 80);
  window.dispatchEvent(new CustomEvent(notificationChangedEvent));
}

export function readNotifications() {
  return readStoredNotifications();
}

export async function refreshNotificationsFromDatabase() {
  if (!window.api?.listNotifications) return readStoredNotifications();

  try {
    const notifications = await window.api.listNotifications({ limit: 80 });
    if (!Array.isArray(notifications)) return readStoredNotifications();

    writeStoredNotifications(notifications);
    return readStoredNotifications();
  } catch {
    return readStoredNotifications();
  }
}

export function addNotification({ title, message, level = 'INFO', target = '', href = '' }) {
  const notification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
    level,
    target,
    href,
    read: false,
    createdAt: new Date().toISOString(),
  };

  writeStoredNotifications([notification, ...readStoredNotifications()]);

  if (window.api?.addNotification) {
    window.api.addNotification(notification)
      .then(() => refreshNotificationsFromDatabase())
      .catch(() => {});
  }

  return notification;
}

export function markNotificationRead(notificationId) {
  writeStoredNotifications(readStoredNotifications().map((notification) => (
    notification.id === notificationId ? { ...notification, read: true } : notification
  )));

  if (window.api?.markNotificationRead) {
    window.api.markNotificationRead(notificationId)
      .then(() => refreshNotificationsFromDatabase())
      .catch(() => {});
  }
}

export async function clearNotifications() {
  if (!window.api?.clearNotifications) throw new Error('알림 저장소에 연결할 수 없습니다.');

  const result = await window.api.clearNotifications();
  if (result?.ok === false) throw new Error(result.message || '로컬 알림을 비우지 못했습니다.');
  writeStoredNotifications([]);

  if (isSharedApiEnabled() && navigator.onLine) {
    const cloudResult = await sharedDataService.clearCloudNotifications();
    if (!cloudResult.ok) {
      throw new Error(`이 PC의 알림은 비웠지만 AWS 동기화 알림 삭제에 실패했습니다: ${cloudResult.message || '알 수 없는 오류'}`);
    }
  }

  return { deletedCount: result?.deletedCount ?? 0 };
}
