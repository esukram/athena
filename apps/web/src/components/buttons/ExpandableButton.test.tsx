import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { ExpandableButton } from './ExpandableButton';

describe('ExpandableButton', () => {
  it('renders main button with children', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Primary Action
      </ExpandableButton>,
    );
    expect(screen.getByText('Primary Action')).toBeInTheDocument();
  });

  it('executes primary onClick when main button clicked', () => {
    const onClick = vi.fn();
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={onClick} actions={actions}>
        Click me
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-main'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('opens dropdown when chevron clicked', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders all action items in dropdown', () => {
    const actions = [
      { label: 'Action 1', onClick: vi.fn() },
      { label: 'Action 2', onClick: vi.fn() },
    ];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
  });

  it('executes action onClick when item clicked', () => {
    const action1Click = vi.fn();
    const actions = [
      { label: 'Action 1', onClick: action1Click },
      { label: 'Action 2', onClick: vi.fn() },
    ];

    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    fireEvent.click(screen.getByText('Action 1'));

    expect(action1Click).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown after action selection', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Action 1'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <div>
        <ExpandableButton onClick={vi.fn()} actions={actions}>
          Button
        </ExpandableButton>
        <div data-testid="outside">Outside</div>
      </div>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes dropdown on Escape key', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions} disabled>
        Button
      </ExpandableButton>,
    );

    expect(screen.getByTestId('expandable-button-main')).toBeDisabled();
    expect(screen.getByTestId('expandable-button-dropdown')).toBeDisabled();
  });

  it('does not execute onClick when disabled', () => {
    const onClick = vi.fn();
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={onClick} actions={actions} disabled>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-main'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not open dropdown when disabled', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions} disabled>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('applies variant styling correctly', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions} variant="danger">
        Danger Button
      </ExpandableButton>,
    );

    const mainButton = screen.getByTestId('expandable-button-main');
    expect(mainButton.className).toContain('bg-danger');
  });

  it('colors the primary toggle and menu with the accent fill, not the ink token', () => {
    const actions = [{ label: 'Randomized', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Train
      </ExpandableButton>,
    );

    // Toggle shares the main button's accent fill and nudges on press.
    const toggle = screen.getByTestId('expandable-button-dropdown');
    expect(toggle).toHaveClass('bg-accent', 'active:translate-y-px');
    expect(toggle).not.toHaveClass('bg-primary-700');

    // Open the menu and check the panel + first action.
    fireEvent.click(toggle);

    const menu = screen.getByTestId('expandable-button-menu');
    expect(menu).toHaveClass('bg-accent');
    expect(menu).not.toHaveClass('bg-primary-700');

    // Action items carry only the text/hover accent tokens (no bg-accent).
    const action = screen.getByTestId('expandable-button-action-0');
    expect(action).toHaveClass('text-accent-ink', 'hover:bg-accent-press');
    expect(action).not.toHaveClass('hover:bg-primary-800');
  });

  it('highlights both halves on hover of either (shared group-hover)', () => {
    const actions = [{ label: 'Randomized', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Train
      </ExpandableButton>,
    );

    // Both halves carry the group-scoped highlight, so hovering either lights up
    // both. The toggle no longer carries a self-only `hover:bg-*`.
    const main = screen.getByTestId('expandable-button-main');
    const toggle = screen.getByTestId('expandable-button-dropdown');
    expect(main).toHaveClass('group-hover/split:bg-accent-press');
    expect(toggle).toHaveClass('group-hover/split:bg-accent-press');
    expect(toggle).not.toHaveClass('hover:bg-accent-press');
  });

  it('disables individual action when action.disabled is true', () => {
    const disabledAction = vi.fn();
    const actions = [
      { label: 'Disabled Action', onClick: disabledAction, disabled: true },
      { label: 'Enabled Action', onClick: vi.fn() },
    ];

    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    fireEvent.click(screen.getByTestId('expandable-button-dropdown'));
    fireEvent.click(screen.getByText('Disabled Action'));

    expect(disabledAction).not.toHaveBeenCalled();
  });

  it('has correct ARIA attributes on dropdown trigger', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton onClick={vi.fn()} actions={actions}>
        Button
      </ExpandableButton>,
    );

    const trigger = screen.getByTestId('expandable-button-dropdown');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('applies custom dropdownLabel', () => {
    const actions = [{ label: 'Action 1', onClick: vi.fn() }];
    render(
      <ExpandableButton
        onClick={vi.fn()}
        actions={actions}
        dropdownLabel="Custom label"
      >
        Button
      </ExpandableButton>,
    );

    expect(
      screen.getByRole('button', { name: 'Custom label' }),
    ).toBeInTheDocument();
  });
});
