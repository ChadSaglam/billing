import { useId } from 'react';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface FormFieldProps {
  label: string;
  /** Input id; generated when omitted so the label is always associated. */
  id?: string;
  required?: boolean;
  children?: ReactNode;
  // Shorthand for simple text inputs
  value?: string | number;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function FormField({
  label,
  id,
  required,
  children,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  max,
  step,
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </Label>
      {children ?? (
        <Input
          id={inputId}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          required={required}
          aria-required={required || undefined}
          min={min}
          max={max}
          step={step}
        />
      )}
    </div>
  );
}
