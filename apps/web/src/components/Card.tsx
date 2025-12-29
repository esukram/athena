import { ReactNode } from 'react';

type CardVariant = 'surface' | 'surface-container' | 'surface-container-low';
type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  as?: 'div' | 'form' | 'section';
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

const variantClasses: Record<CardVariant, string> = {
  surface: 'bg-surface',
  'surface-container': 'bg-surface-container',
  'surface-container-low': 'bg-surface-container-low',
};

const paddingClasses: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = ({
  children,
  variant = 'surface-container',
  padding = 'lg',
  className = '',
  as: Component = 'div',
  onSubmit,
}: CardProps) => {
  const baseClasses = 'rounded-xl shadow-md';
  const variantClass = variantClasses[variant];
  const paddingClass = paddingClasses[padding];

  const combinedClassName = `${baseClasses} ${variantClass} ${paddingClass} ${className}`.trim();

  if (Component === 'form') {
    return (
      <form className={combinedClassName} onSubmit={onSubmit}>
        {children}
      </form>
    );
  }

  return <Component className={combinedClassName}>{children}</Component>;
};
