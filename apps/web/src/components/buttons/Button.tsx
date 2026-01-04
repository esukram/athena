import { forwardRef } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'icon'
  | 'iconDanger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Button content */
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg',
  secondary:
    'bg-primary-50 text-primary-600 hover:bg-primary-100 hover:shadow-md',
  ghost:
    'text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg',
  icon: 'rounded-full bg-white/80 shadow-md opacity-90 lg:opacity-80 lg:hover:opacity-100 hover:bg-primary-50 hover:text-primary-600',
  iconDanger:
    'rounded-full bg-white/80 shadow-md opacity-90 lg:opacity-80 lg:hover:opacity-100 hover:bg-red-50 hover:text-red-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

// Icon button size overrides (padding only, no px/text)
const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'p-1.5 sm:p-2',
  md: 'p-2',
  lg: 'p-3',
};

/**
 * Base button component with consistent styling.
 * Supports multiple variants (primary, secondary, ghost, danger, icon, iconDanger) and sizes.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', className = '', children, ...props },
    ref,
  ) => {
    const isIconVariant = variant === 'icon' || variant === 'iconDanger';
    const appliedSizeClasses = isIconVariant
      ? iconSizeClasses[size]
      : sizeClasses[size];

    return (
      <button
        ref={ref}
        type="button"
        className={`
          ${appliedSizeClasses}
          ${variantClasses[variant]}
          ${isIconVariant ? '' : 'font-semibold rounded-lg'}
          transition-all duration-200
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
