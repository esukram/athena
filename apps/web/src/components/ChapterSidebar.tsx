import { ListFilter, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import React, { RefObject } from 'react';

export interface ChapterItem {
  id: string;
  order: number;
}

interface ChapterSidebarProps<T extends ChapterItem> {
  /** Title for the sidebar header */
  title: string;
  /** All chapters to display */
  chapters: T[];
  /** Chapters after filtering (for search) */
  filteredChapters: T[];
  /** Currently selected chapter index */
  selectedIndex: number;
  /** Handler for chapter selection */
  onSelect: (chapter: T) => void;
  /** Whether search input is open */
  isSearchOpen: boolean;
  /** Handler to toggle search open/closed */
  onSearchToggle: () => void;
  /** Current search query */
  searchQuery: string;
  /** Handler for search query changes */
  onSearchChange: (value: string) => void;
  /** Function to get display text for each chapter */
  getDisplayText: (chapter: T) => React.ReactNode;
  /** Optional set of chapter IDs to highlight (e.g., annotated chapters) */
  highlightedChapterIds?: Set<string>;
  /** Optional ref for search input */
  searchInputRef?: React.Ref<HTMLInputElement>;
  /** Optional ref map for chapter buttons (for scroll-into-view) */
  chapterButtonsRef?: RefObject<Map<number, HTMLButtonElement> | null>;
}

/**
 * A reusable chapter navigation sidebar with search functionality.
 */
export function ChapterSidebar<T extends ChapterItem>({
  title,
  chapters,
  filteredChapters,
  selectedIndex,
  onSelect,
  isSearchOpen,
  onSearchToggle,
  searchQuery,
  onSearchChange,
  getDisplayText,
  highlightedChapterIds,
  searchInputRef,
  chapterButtonsRef,
}: ChapterSidebarProps<T>) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 overflow-hidden bg-surface-container-low rounded-xl shadow-md p-4 h-fit lg:sticky lg:top-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
          {title}
        </h3>
        <button
          onClick={() => {
            onSearchToggle();
            if (isSearchOpen) {
              onSearchChange('');
            }
          }}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant hover:text-on-surface"
          aria-label={
            isSearchOpen
              ? t('globalSearch.closeSearch')
              : t('globalSearch.openSearch')
          }
        >
          {isSearchOpen ? <X size={18} /> : <ListFilter size={18} />}
        </button>
      </div>

      {isSearchOpen && (
        <div className="mb-3">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('lectureTrain.searchChapters')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-on-surface"
          />
        </div>
      )}

      <nav
        className={`space-y-1 max-h-40 md:max-h-48 lg:max-h-96 overflow-y-auto`}
      >
        {filteredChapters.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic px-3 py-2">
            {t('lectureTrain.noChaptersFound')}
          </p>
        ) : (
          filteredChapters.map((chapter) => {
            const originalIndex = chapters.findIndex(
              (c) => c.id === chapter.id,
            );
            const isHighlighted = highlightedChapterIds?.has(chapter.id);

            return (
              <button
                key={chapter.id}
                ref={(el) => {
                  if (chapterButtonsRef?.current) {
                    if (el) {
                      chapterButtonsRef.current.set(originalIndex, el);
                    } else {
                      chapterButtonsRef.current.delete(originalIndex);
                    }
                  }
                }}
                onClick={() => onSelect(chapter)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                  isHighlighted
                    ? 'border-l-4 border-amber-400 bg-linear-to-r from-amber-50 to-transparent'
                    : ''
                } ${
                  selectedIndex === originalIndex
                    ? 'bg-primary-100 text-primary-700 shadow-sm'
                    : 'text-on-surface hover:bg-gray-100'
                }`}
              >
                <span className="text-sm wrap-break-words flex items-center gap-2">
                  <span className="flex-1">
                    {chapter.order + 1}. {getDisplayText(chapter)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </nav>
    </div>
  );
}
