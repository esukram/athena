import { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Button content */
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-press shadow-elevate hover:shadow-elevate-raised',
  secondary:
    'bg-accent-soft text-accent-soft-ink hover:bg-accent-soft-hover',
  ghost:
    'border border-border text-ink-soft hover:bg-surface-2 hover:text-ink disabled:opacity-40',
  danger: 'bg-danger text-danger-ink hover:bg-danger-press',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/**
 * Base button component with consistent styling.
 * Supports multiple variants (primary, secondary, ghost, danger) and sizes.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', className = '', children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          font-semibold rounded-lg transition-all duration-200
          active:translate-y-px
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `.trim()}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
