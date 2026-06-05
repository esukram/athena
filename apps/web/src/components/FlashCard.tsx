import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import type { ReactNode } from 'react';

export interface FlashCardProps {
  question: string;
  answer: string | null;
  association?: string | null;
  flipped: boolean;
  onFlip: () => void;
  flipping: boolean;
  voice?: ReactNode;
  annotateButton?: ReactNode;
}

export const FlashCard = ({
  question,
  answer,
  association,
  flipped,
  onFlip,
  flipping,
  voice,
  annotateButton,
}: FlashCardProps) => {
  const { t } = useTranslation();

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="flip-scene">
      <div
        className={'flip-card ' + (flipping ? 'flipping' : '')}
        onClick={onFlip}
      >
        {!flipped ? (
          <div className="flip-face">
            <div className="flex justify-between items-center mb-5 gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {association && (
                  <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-soft-ink">
                    {association}
                  </span>
                )}
                {annotateButton && (
                  <span onClick={stopPropagation}>{annotateButton}</span>
                )}
                {voice && <span onClick={stopPropagation}>{voice}</span>}
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint shrink-0">
                {t('lectureTrain.sideQuestion')}
              </span>
            </div>
            <div className="flex-1 flex items-center text-2xl md:text-3xl font-extrabold leading-tight text-ink">
              {question}
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm text-ink-faint">
              <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                Space
              </kbd>
              {t('lectureTrain.tapToReveal')}
            </div>
          </div>
        ) : (
          <div className="flip-face">
            <div className="flex justify-between items-center mb-5 gap-4">
              <span className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft truncate max-w-[70%]">
                {question}
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint shrink-0">
                {t('lectureTrain.sideAnswer')}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto prose prose-lg dark:prose-invert max-w-none">
              {answer ? (
                <ReactMarkdown>{answer}</ReactMarkdown>
              ) : (
                <p className="italic text-ink-faint">
                  {t('lectureTrain.noAnswerYet')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
