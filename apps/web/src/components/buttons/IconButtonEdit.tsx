import { Pencil } from 'lucide-react';

import { forwardRef } from 'react';

import { IconButton, type IconButtonProps } from './IconButton';

type IconButtonEditProps = Omit<IconButtonProps, 'icon' | 'variant'>;

/**
 * Edit icon button with primary hover styling.
 */
export const IconButtonEdit = forwardRef<
  HTMLButtonElement,
  IconButtonEditProps
>((props, ref) => {
  return <IconButton ref={ref} icon={Pencil} variant="primary" {...props} />;
});

IconButtonEdit.displayName = 'IconButtonEdit';
