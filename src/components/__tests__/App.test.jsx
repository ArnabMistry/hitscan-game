import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App.jsx';

describe('App smoke', () => {
  it('renders shell and updates debug visibility by mode', () => {
    render(<App />);

    expect(screen.getByText('Gesture Ballistics Interface')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByLabelText('Debug metrics')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Training'), {
      target: { value: 'live-fire' },
    });

    expect(screen.queryByLabelText('Debug metrics')).not.toBeInTheDocument();
  });
});
