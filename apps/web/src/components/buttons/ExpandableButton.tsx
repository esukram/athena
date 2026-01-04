import { ChevronDown } from 'lucide-react';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, type ButtonVariant } from './Button';

export interface ExpandableButtonAction {
  /** Label text for the action */
  label: string;
  /** Callback when action is clicked */
  onClick: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
}

export interface ExpandableButtonProps {
  /** Main button content */
  children: React.ReactNode;
  /** Primary action when main button is clicked */
  onClick: () => void;
  /** Alternative actions shown in dropdown */
  actions: ExpandableButtonAction[];
  /** Visual variant */
  variant?: ButtonVariant;
  /** Whether the entire button is disabled */
  disabled?: boolean;
  /** Accessible label for the dropdown trigger */
  dropdownLabel?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the inner button (use for sizing like py-2.5) */
  buttonClassName?: string;
}

/**
 * A split button component with a main action and dropdown for alternatives.
 * Click the main button area to execute the primary action.
 * Click the chevron to open a menu with alternative actions.
 */
export const ExpandableButton = ({
  children,
  onClick,
  actions,
  variant = 'primary',
  disabled = false,
  dropdownLabel = 'Show more options',
  className = '',
  buttonClassName = '',
}: ExpandableButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  // Close dropdown on Escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleClickOutside, handleKeyDown]);

  const handleMainClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  const handleToggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleActionClick = (action: ExpandableButtonAction) => {
    if (!action.disabled) {
      action.onClick();
      setIsOpen(false);
    }
  };

  // Variant-specific styling for dropdown
  const dropdownBorderClasses: Record<ButtonVariant, string> = {
    primary: 'border-primary-400/30',
    secondary: 'border-primary-300',
    ghost: 'border-primary-200',
    danger: 'border-red-400/30',
  };

  return (
    <div ref={containerRef} className={`relative flex ${className}`}>
      {/* Main button */}
      <Button
        variant={variant}
        disabled={disabled}
        onClick={handleMainClick}
        className={`rounded-r-none! pr-3! flex-1 ${buttonClassName}`}
        data-testid="expandable-button-main"
      >
        {children}
      </Button>

      {/* Dropdown trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggleDropdown}
        aria-label={dropdownLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`
          flex items-center justify-center px-2
          border-l-2 ${dropdownBorderClasses[variant]}
          rounded-r-lg transition-all duration-200
          ${
            variant === 'primary'
              ? 'bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900'
              : ''
          }
          ${variant === 'secondary' ? 'bg-primary-50 text-primary-600 hover:bg-primary-200 active:bg-primary-300' : ''}
          ${variant === 'ghost' ? 'text-primary-600 hover:bg-primary-100 active:bg-primary-200' : ''}
          ${variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800' : ''}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        data-testid="expandable-button-dropdown"
      >
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && actions.length > 0 && (
        <div
          ref={menuRef}
          role="menu"
          className={`
            absolute top-full left-0 mt-0.5 z-50
            w-full font-semibold
            rounded-lg shadow-lg
            animate-in fade-in slide-in-from-top-1 duration-150
            ${variant === 'primary' ? 'bg-primary-700 border border-primary-600' : ''}
            ${variant === 'secondary' ? 'bg-primary-50 border border-primary-200' : ''}
            ${variant === 'ghost' ? 'bg-white border border-gray-200' : ''}
            ${variant === 'danger' ? 'bg-red-600 border border-red-500' : ''}
          `}
          data-testid="expandable-button-menu"
        >
          {actions.map((action, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => handleActionClick(action)}
              className={`
                w-full px-4 py-2 text-left text-sm
                first:rounded-t-lg last:rounded-b-lg
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
                ${variant === 'primary' ? 'text-white hover:bg-primary-800' : ''}
                ${variant === 'secondary' ? 'text-primary-700 hover:bg-primary-100' : ''}
                ${variant === 'ghost' ? 'text-gray-700 hover:bg-primary-50' : ''}
                ${variant === 'danger' ? 'text-white hover:bg-red-700' : ''}
              `}
              data-testid={`expandable-button-action-${index}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

ExpandableButton.displayName = 'ExpandableButton';
