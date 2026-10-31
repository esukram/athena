import { Pencil } from 'lucide-react';

import { IconButton, type IconButtonProps } from './IconButton';

type IconButtonEditProps = Omit<IconButtonProps, 'icon' | 'variant'>;

/**
 * Edit icon button with primary hover styling.
 */
export const IconButtonEdit = (props: IconButtonEditProps) => (
  <IconButton icon={Pencil} variant="primary" {...props} />
);
