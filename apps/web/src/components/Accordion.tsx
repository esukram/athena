import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import React, { ReactNode, useState } from 'react';

interface AccordionProps {
  title: string;
  description?: string;
  children?: ReactNode;
  leftIcon?: ReactNode;
  noShadow?: boolean;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  description = '',
  children,
  leftIcon,
  noShadow = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const shortDescription =
    description.length > 100
      ? description.substring(0, 100) + '...'
      : description;

  return (
    <div className={`rounded-xl bg-surface-container overflow-hidden ${noShadow ? '' : 'shadow-md'}`}>
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
        className="w-full flex items-start justify-between p-6 text-left cursor-pointer"
      >
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-on-background mb-2">
          {leftIcon && (
            <span onClick={(e) => e.stopPropagation()}>{leftIcon}</span>
          )}
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
        <div className="ml-4 mt-2 text-on-surface-variant">
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {isOpen && (
        <div className="px-6 pb-6 bg-surface-container text-on-surface text-base">
          {children || <p className="whitespace-pre-wrap">{description}</p>}
        </div>
      )}
    </div>
  );
};
