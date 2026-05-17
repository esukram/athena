import type { LucideIcon } from 'lucide-react';

import { forwardRef } from 'react';

import { Button } from './Button';

export type IconButtonVariant = 'primary' | 'danger';

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
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
  /** Additional CSS classes for the icon itself (e.g. spin animation, color) */
  iconClassName?: string;
}

// Icon button specific styling
const sizeClasses = {
  sm: '!p-1.5 sm:!p-2',
  md: '!p-2',
};

const iconSizeClasses = {
  sm: 'w-4 h-4 sm:w-4.5 sm:h-4.5',
  md: 'w-4.5 h-4.5',
};

const variantClasses = {
  primary: 'hover:bg-primary-50 hover:text-primary-600',
  danger: 'hover:!bg-red-50 hover:!text-red-600',
};

/**
 * Icon-only button component that composes the base Button.
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
      iconClassName = '',
      ...props
    },
    ref,
  ) => {
    // IconButton applies its own styling by overriding Button's defaults via className
    const iconButtonClasses = `
      ${sizeClasses[size]}
      ${variantClasses[variant]}
      !rounded-full !bg-white/80 !shadow-md 
      !font-normal
      opacity-90 lg:opacity-80 lg:hover:opacity-100
      ${className}
    `.trim();

    return (
      <Button
        ref={ref}
        variant="ghost"
        aria-label={ariaLabel}
        title={title || ariaLabel}
        className={iconButtonClasses}
        {...props}
      >
        <Icon
          className={`${iconSizeClasses[size]} text-gray-600 ${iconClassName}`.trim()}
        />
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';
