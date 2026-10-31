import { ArrowRightLeft } from 'lucide-react';

import { IconButton, type IconButtonProps } from './IconButton';

type IconButtonMoveProps = Omit<IconButtonProps, 'icon' | 'variant'>;

/**
 * Move icon button with primary hover styling.
 */
export const IconButtonMove = (props: IconButtonMoveProps) => (
  <IconButton icon={ArrowRightLeft} variant="primary" {...props} />
);
