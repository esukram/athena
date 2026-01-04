import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { forwardRef } from 'react';

interface SearchToggleProps {
  /** Whether the search input is open/visible */
  isOpen: boolean;
  /** Current search query value */
  query: string;
  /** Handler to toggle open/closed state */
  onToggle: () => void;
  /** Handler for query changes */
  onQueryChange: (value: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * A search toggle button and input field combo.
 * When collapsed, shows just a search icon. When expanded, shows an input field.
 */
export const SearchToggle = forwardRef<HTMLInputElement, SearchToggleProps>(
  ({ isOpen, query, onToggle, onQueryChange, placeholder }, ref) => {
    const { t } = useTranslation();

    return (
      <>
        <button
          onClick={onToggle}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant hover:text-on-surface"
          aria-label={
            isOpen
              ? t('globalSearch.closeSearch')
              : t('globalSearch.openSearch')
          }
        >
          {isOpen ? <X size={18} /> : <Search size={18} />}
        </button>
        {isOpen && (
          <div className="mb-3 mt-4">
            <input
              ref={ref}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-on-surface"
            />
          </div>
        )}
      </>
    );
  },
);

SearchToggle.displayName = 'SearchToggle';
