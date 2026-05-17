import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { AutoAdvanceToggle } from './AutoAdvanceToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AutoAdvanceToggle', () => {
  it('renders the label', () => {
    render(<AutoAdvanceToggle checked={false} onChange={() => {}} />);
    expect(screen.getByText('speech.autoAdvance')).toBeInTheDocument();
  });

  it('reflects the checked prop', () => {
    render(<AutoAdvanceToggle checked={true} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('fires onChange with the toggled value when clicked', () => {
    const onChange = vi.fn();
    render(<AutoAdvanceToggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('fires onChange with false when unticked', () => {
    const onChange = vi.fn();
    render(<AutoAdvanceToggle checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
