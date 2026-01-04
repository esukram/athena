import type { LucideIcon } from 'lucide-react';

import { forwardRef } from 'react';

import { Button, type ButtonSize } from './Button';

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
}

const iconSizeClasses = {
  sm: 'w-4 h-4 sm:w-5 sm:h-5',
  md: 'w-5 h-5',
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
      ...props
    },
    ref,
  ) => {
    // Map IconButton variant to Button variant
    const buttonVariant = variant === 'danger' ? 'iconDanger' : 'icon';

    return (
      <Button
        ref={ref}
        variant={buttonVariant}
        size={size as ButtonSize}
        aria-label={ariaLabel}
        title={title || ariaLabel}
        className={className}
        {...props}
      >
        <Icon className={`${iconSizeClasses[size]} text-gray-600`} />
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';
