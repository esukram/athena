import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useEffect, useRef, useState } from 'react';

import { trpc } from '../utils/trpc';

export const GlobalSearch = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Fetch search results
  const searchQuery = trpc.chapters.searchChapters.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.trim().length > 0 },
  );

  const results = searchQuery.data || [];

  // Fetch all lectures for title lookup
  const lecturesQuery = trpc.lectures.getLectures.useQuery();

  // Create a map of lectureId -> title for display
  const lectureMap = new Map(
    (lecturesQuery.data || []).map((lecture) => [lecture.id, lecture.title]),
  );

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const maxIndex = results.length - 1;
          return prev < maxIndex ? prev + 1 : 0;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const maxIndex = results.length - 1;
          return prev > 0 ? prev - 1 : maxIndex;
        });
      } else if (
        e.key === 'Enter' &&
        selectedIndex >= 0 &&
        selectedIndex < results.length
      ) {
        e.preventDefault();
        const selected = results[selectedIndex];
        handleResultClick(selected.lectureId, selected.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (lectureId: string, chapterId: string) => {
    navigate(`/lecture/${lectureId}/${chapterId}`);
    setIsOpen(false);
    setQuery('');
  };

  // Highlight matching tokens in text
  const highlightMatches = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;

    const escapedTokens = tokens.map((t) =>
      t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, index) => {
      const isMatch = tokens.some((token) => part.toLowerCase() === token);
      if (isMatch) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Scroll selected item into view
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (selectedIndex >= 0 && itemsRef.current[selectedIndex]) {
      itemsRef.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    // Reset refs array when results change
    itemsRef.current = itemsRef.current.slice(0, results.length);
  }, [results]);

  return (
    <div ref={containerRef} className="relative">
      {isOpen ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('globalSearch.searchChapters')}
            className="w-48 sm:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-on-surface"
          />
          <button
            onClick={() => {
              setIsOpen(false);
              setQuery('');
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant hover:text-on-surface"
            aria-label={t('globalSearch.closeSearch')}
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-base font-medium text-on-surface hover:text-primary-600 transition-colors"
          aria-label={t('globalSearch.openSearch')}
        >
          <Search size={18} />
          <span className="hidden sm:inline">{t('common.search')}</span>
        </button>
      )}

      {/* Search Results Overlay */}
      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 max-h-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          {searchQuery.isLoading || query !== debouncedQuery ? (
            <div className="p-4 text-sm text-on-surface-variant">
              {t('globalSearch.searching')}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-on-surface-variant">
              {t('globalSearch.noResults')}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {results.map((chapter, index) => (
                <li key={chapter.id}>
                  <button
                    ref={(el) => (itemsRef.current[index] = el)}
                    onClick={() =>
                      handleResultClick(chapter.lectureId, chapter.id)
                    }
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="font-medium text-on-surface mb-1">
                      {highlightMatches(
                        chapter.firstQuestion?.question ||
                          t('common.untitled'),
                        debouncedQuery,
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span>
                        {lectureMap.get(chapter.lectureId) ||
                          t('globalSearch.unknownLecture')}
                      </span>
                      {chapter.association && (
                        <>
                          <span>•</span>
                          <span className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full">
                            {highlightMatches(
                              chapter.association,
                              debouncedQuery,
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

