import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-5xl',
  '4xl': 'max-w-6xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

export default function Modal({
  open,
  title,
  description,
  eyebrow,
  children,
  footer,
  headerActions,
  onClose,
  size = 'lg',
  bodyClassName = 'overflow-y-auto p-5',
  panelClassName = '',
  overlayClassName = '',
  showCloseButton = true,
  closeOnOverlay = true,
  closeOnEscape = true,
  zIndexClassName = 'z-50',
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-gray-950/50 p-4 ${overlayClassName}`}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnOverlay && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className={`flex max-h-[calc(100vh-2rem)] w-full ${sizeClasses[size] ?? sizeClasses.lg} flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700/60 dark:bg-gray-800 ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {(title || description || eyebrow || headerActions || (showCloseButton && onClose)) && (
          <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
            <div className="min-w-0">
              {eyebrow && <p className="text-xs font-semibold uppercase text-accent-600 dark:text-accent-300">{eyebrow}</p>}
              {title && <h2 id={titleId} className={`${eyebrow ? 'mt-1 ' : ''}text-lg font-bold text-gray-900 dark:text-gray-100`}>{title}</h2>}
              {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
            </div>
            {(headerActions || (showCloseButton && onClose)) && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {headerActions}
                {showCloseButton && onClose && (
                  <button className="btn btn-secondary" type="button" onClick={onClose}>닫기</button>
                )}
              </div>
            )}
          </header>
        )}

        <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700/60">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
