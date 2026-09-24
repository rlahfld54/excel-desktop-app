import { useState } from 'react';

import Modal from './Modal';

export default function SearchButton({
  onSearch,
  disabled = false,
  className = 'btn btn-primary whitespace-nowrap',
  children = '조회',
}) {
  const [phase, setPhase] = useState('idle');

  const handleClick = async () => {
    if (disabled || phase === 'loading') return;

    setPhase('loading');
    await onSearch();
    setPhase('complete');
  };

  const isLoading = phase === 'loading';

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading}
      >
        {children}
      </button>

      <Modal
        open={phase !== 'idle'}
        title={isLoading ? '조회 중' : '조회 완료'}
        description={
          isLoading
            ? '선택한 조건으로 데이터를 불러오고 있습니다.'
            : '선택한 조건의 데이터를 모두 불러왔습니다.'
        }
        size="sm"
        onClose={isLoading ? undefined : () => setPhase('idle')}
        showCloseButton={!isLoading}
        closeOnOverlay={!isLoading}
        closeOnEscape={!isLoading}
        bodyClassName="p-6"
      >
        <div
          className="flex items-center justify-center gap-3 py-2"
          role="status"
          aria-live="polite"
        >
          {isLoading ? (
            <span
              className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-teal-600 dark:border-gray-600 dark:border-t-teal-400"
              aria-hidden="true"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
              aria-hidden="true"
            >
              ✓
            </span>
          )}
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {isLoading ? '잠시만 기다려 주세요.' : '조회가 완료되었습니다.'}
          </p>
        </div>
      </Modal>
    </>
  );
}
