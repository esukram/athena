import { Trash2 } from 'lucide-react';
import { forwardRef } from 'react';

import { IconButton, type IconButtonProps } from './IconButton';

type IconButtonDeleteProps = Omit<IconButtonProps, 'icon' | 'variant'>;

/**
 * Delete icon button with danger hover styling.
 */
export const IconButtonDelete = forwardRef<
  HTMLButtonElement,
  IconButtonDeleteProps
>((props, ref) => {
  return <IconButton ref={ref} icon={Trash2} variant="danger" {...props} />;
});

IconButtonDelete.displayName = 'IconButtonDelete';
