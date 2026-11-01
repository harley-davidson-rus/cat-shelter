import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({
  className = '',
  wrapperClassName = '',
  disabled,
  ...props
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const actionLabel = isVisible ? 'Скрыть пароль' : 'Показать пароль';

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...props}
        ref={ref}
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        onMouseDown={(event) => event.preventDefault()}
        disabled={disabled}
        aria-label={actionLabel}
        aria-pressed={isVisible}
        title={actionLabel}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';
