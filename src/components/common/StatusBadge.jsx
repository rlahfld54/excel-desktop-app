import React from 'react';

const toneClasses = {
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const statusToneMap = {
  ACTIVE: 'green',
  APPROVED: 'green',
  ADMIN: 'green',
  INFO: 'green',
  SUCCESS: 'green',
  완료: 'green',
  정상: 'green',
  '병합 완료': 'green',
  '예외 등록': 'green',
  HOLD: 'amber',
  PENDING: 'amber',
  REVIEW: 'amber',
  MANAGER: 'amber',
  WARN: 'amber',
  WARNING: 'amber',
  대기: 'amber',
  검토: 'amber',
  '확인 필요': 'amber',
  INACTIVE: 'red',
  ERROR: 'red',
  FAILED: 'red',
  실패: 'red',
  '처리 지연': 'red',
  EMAIL: 'blue',
  KAKAO: 'teal',
  PHONE: 'violet',
};

export function getStatusTone(status, fallback = 'accent') {
  return statusToneMap[String(status ?? '').trim()] ?? fallback;
}

export default function StatusBadge({
  status,
  children,
  tone,
  className = '',
  rounded = true,
}) {
  const resolvedTone = tone ?? getStatusTone(status);
  const colorClass = toneClasses[resolvedTone] ?? toneClasses.accent;

  return (
    <span className={`inline-flex items-center ${rounded ? 'rounded-full' : 'rounded'} px-2 py-0.5 text-xs font-semibold ${colorClass} ${className}`}>
      {children ?? status}
    </span>
  );
}
