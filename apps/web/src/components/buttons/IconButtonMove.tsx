import { ArrowRightLeft } from 'lucide-react';

import { forwardRef } from 'react';

import { IconButton, type IconButtonProps } from './IconButton';

type IconButtonMoveProps = Omit<IconButtonProps, 'icon' | 'variant'>;

/**
 * Move icon button with primary hover styling.
 */
export const IconButtonMove = forwardRef<
  HTMLButtonElement,
  IconButtonMoveProps
>((props, ref) => {
  return (
    <IconButton ref={ref} icon={ArrowRightLeft} variant="primary" {...props} />
  );
});

IconButtonMove.displayName = 'IconButtonMove';
