import React, { useId } from 'react';

export default function FormField({
  label,
  children,
  hint,
  error,
  required = false,
  className = '',
  labelClassName = '',
}) {
  const hintId = useId();

  return (
    <label className={`block ${className}`}>
      <span className={`mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400 ${labelClassName}`}>
        {label}
        {required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}
      </span>
      {children}
      {(error || hint) && (
        <span id={hintId} className={`mt-1 block text-xs ${error ? 'text-rose-600 dark:text-rose-300' : 'text-gray-500 dark:text-gray-400'}`}>
          {error || hint}
        </span>
      )}
    </label>
  );
}
