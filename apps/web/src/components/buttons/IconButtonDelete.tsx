import { Trash2 } from 'lucide-react';

import { IconButton, type IconButtonProps } from './IconButton';

type IconButtonDeleteProps = Omit<IconButtonProps, 'icon' | 'variant'>;

/**
 * Delete icon button with danger hover styling.
 */
export const IconButtonDelete = (props: IconButtonDeleteProps) => (
  <IconButton icon={Trash2} variant="danger" {...props} />
);
