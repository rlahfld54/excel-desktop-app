import React from 'react';

import FormField from './FormField';

export default function DateRangeFields({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  errors = {},
  required = true,
  startLabel = '시작일',
  endLabel = '마지막일',
  inputClassName = 'form-input w-full',
}) {
  const errorClass = 'border-rose-400 focus:border-rose-500';

  return (
    <>
      <FormField label={startLabel} error={errors.startDate} required={required}>
        <input
          className={`${inputClassName} ${errors.startDate ? errorClass : ''}`}
          type="date"
          value={startDate}
          aria-invalid={Boolean(errors.startDate)}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </FormField>
      <FormField label={endLabel} error={errors.endDate} required={required}>
        <input
          className={`${inputClassName} ${errors.endDate ? errorClass : ''}`}
          type="date"
          value={endDate}
          min={startDate || undefined}
          aria-invalid={Boolean(errors.endDate)}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </FormField>
    </>
  );
}
