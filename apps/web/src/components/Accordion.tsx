import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import React, { ReactNode, useState } from 'react';

interface AccordionProps {
  title: string;
  description?: string;
  children?: ReactNode;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  noShadow?: boolean;
  noPadding?: boolean;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  description = '',
  children,
  leftIcon,
  rightElement,
  noShadow = false,
  noPadding = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const shortDescription =
    description.length > 100
      ? description.substring(0, 100) + '...'
      : description;

  return (
    <div
      className={`rounded-xl border border-border bg-surface-container overflow-hidden ${noShadow ? '' : 'shadow-sm'}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full flex items-start justify-between ${noPadding ? 'p-0' : 'p-6'} text-left cursor-pointer`}
      >
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-on-background mb-2">
            {leftIcon && <span>{leftIcon}</span>}
            {title}
          </h1>
          {!isOpen && (
            <p className="text-on-surface-variant text-base mt-2 clear-left">
              {shortDescription}
            </p>
          )}
          {isOpen && (
            <p className="text-primary font-medium text-sm mt-1 clear-left">
              {t('accordion.showLess')}
            </p>
          )}
          {!isOpen && (
            <p className="text-primary font-medium text-sm mt-1">
              {t('accordion.readMore')}
            </p>
          )}
        </div>
        <div className="ml-4 mt-2 flex items-center gap-2">
          {rightElement}
          <span className="text-on-surface-variant">
            {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </span>
        </div>
      </div>

      {isOpen && (
        <div
          className={`${noPadding ? 'px-2 pb-2' : 'px-6 pb-6'} bg-surface-container text-on-surface text-base`}
        >
          {children || <p className="whitespace-pre-wrap">{description}</p>}
        </div>
      )}
    </div>
  );
};
