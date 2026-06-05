import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trpc } from '../utils/trpc';

export const GlobalSearch = () => {
  const { t } = useTranslation();
  const [showResults, setShowResults] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Fetch search results
  const searchQuery = trpc.chapters.searchChapters.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.trim().length > 0 },
  );

  const results = useMemo(() => searchQuery.data || [], [searchQuery.data]);

  // Fetch all lectures for title lookup
  const lecturesQuery = trpc.lectures.getLectures.useQuery();

  // Create a map of lectureId -> title for display
  const lectureMap = new Map(
    (lecturesQuery.data || []).map((lecture) => [lecture.id, lecture.title]),
  );

  const handleResultClick = useCallback(
    (lectureId: string, chapterId: string) => {
      navigate(`/learn/${lectureId}/${chapterId}`);
      setShowResults(false);
      setQuery('');
    },
    [navigate],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation while the dropdown is actually visible —
      // otherwise Enter/arrows would act on a hidden result list (e.g. after a
      // click-outside that keeps the typed query).
      if (!showResults || !query.trim()) return;

      if (e.key === 'Escape') {
        setQuery('');
        setSelectedIndex(-1);
        setShowResults(false);
        inputRef.current?.blur();
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
  }, [showResults, query, results, selectedIndex, handleResultClick]);

  // Hide results dropdown on click outside (keep the typed query)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      {/* Tapping anywhere (notably the collapsed icon on narrow screens)
          focuses the width-0 input, which expands it via focus-within. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="group flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 min-w-[200px] transition-all focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft max-[720px]:min-w-0 max-[720px]:w-[42px] max-[720px]:cursor-text max-[720px]:justify-center max-[720px]:px-0 max-[720px]:focus-within:w-[220px] max-[720px]:focus-within:justify-start max-[720px]:focus-within:px-3"
      >
        <Search size={18} className="text-ink-faint shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => {
            if (query.trim()) setShowResults(true);
          }}
          placeholder={t('globalSearch.searchChapters')}
          aria-label={t('globalSearch.openSearch')}
          className="w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint max-[720px]:w-0 max-[720px]:focus:w-full"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setShowResults(false);
              inputRef.current?.focus();
            }}
            className="shrink-0 text-ink-faint transition-colors hover:text-ink max-[720px]:hidden max-[720px]:group-focus-within:block"
            aria-label={t('globalSearch.closeSearch')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Results Overlay */}
      {showResults && query.trim() && (
        <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 max-h-96 bg-surface rounded-xl shadow-sm border border-border overflow-hidden z-50">
          {searchQuery.isLoading || query !== debouncedQuery ? (
            <div className="p-4 text-sm text-on-surface-variant">
              {t('globalSearch.searching')}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-on-surface-variant">
              {t('globalSearch.noResults')}
            </div>
          ) : (
            <ul className="divide-y divide-border-soft max-h-80 overflow-y-auto">
              {results.map((chapter, index) => (
                <li key={chapter.id}>
                  <button
                    ref={(el) => {
                      itemsRef.current[index] = el;
                    }}
                    onClick={() =>
                      handleResultClick(chapter.lectureId, chapter.id)
                    }
                    className={`w-full text-left px-4 py-3 hover:bg-bg-tint transition-colors ${
                      index === selectedIndex ? 'bg-bg-tint' : ''
                    }`}
                  >
                    <div className="font-medium text-on-surface mb-1">
                      {highlightMatches(
                        chapter.firstQuestion?.question || t('common.untitled'),
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
                          <span className="px-2 py-0.5 bg-accent-soft text-accent-soft-ink rounded-full">
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
