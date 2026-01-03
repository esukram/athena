import type { LucideIcon } from 'lucide-react';

import React, { forwardRef } from 'react';

export type IconButtonVariant = 'primary' | 'danger';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The icon component to render */
  icon: LucideIcon;
  /** Accessible label for the button */
  'aria-label': string;
  /** Tooltip text (defaults to aria-label) */
  title?: string;
  /** Visual variant affecting hover colors */
  variant?: IconButtonVariant;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Base icon button component with consistent styling.
 * Use specialized variants (IconButtonEdit, IconButtonDelete, IconButtonMove) for common actions.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon: Icon,
      'aria-label': ariaLabel,
      title,
      variant = 'primary',
      size = 'md',
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizeClasses = {
      sm: 'p-1.5 sm:p-2',
      md: 'p-2',
    };

    const iconSizeClasses = {
      sm: 'w-4 h-4 sm:w-5 sm:h-5',
      md: 'w-5 h-5',
    };

    const variantClasses = {
      primary: 'hover:bg-primary-50 hover:text-primary-600',
      danger: 'hover:bg-red-50 hover:text-red-600',
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        title={title || ariaLabel}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          rounded-full bg-white/80 shadow-md 
          transition-all duration-200 
          opacity-90 lg:opacity-80 lg:hover:opacity-100
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${className}
        `.trim()}
        {...props}
      >
        <Icon className={`${iconSizeClasses[size]} text-gray-600`} />
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
