/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FunPage } from '../FunPage.js';
import { EightBallPage } from './EightBallPage.js';
import { RedCardPage, YellowCardPage } from './RefereeCardPage.js';
import { EIGHT_BALL_ANSWERS, pickAnswer } from './answers.js';

afterEach(cleanup);

const funDir = dirname(fileURLToPath(import.meta.url));

describe('Fun screens', () => {
  it('does not import escrow, protocol, ledger, or auth', () => {
    const files = ['answers.ts', 'RefereeCardPage.tsx', 'EightBallPage.tsx', join('..', 'FunPage.tsx')];
    for (const file of files) {
      const source = readFileSync(join(funDir, file), 'utf8');
      expect(source).not.toMatch(/escrow|protocol|ledger|\/auth\//);
    }
  });

  it('lists the three Fun screens from the hub', () => {
    render(
      <MemoryRouter>
        <FunPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Yellow card' }).getAttribute('href')).toBe('/fun/yellow');
    expect(screen.getByRole('link', { name: 'Red card' }).getAttribute('href')).toBe('/fun/red');
    expect(screen.getByRole('link', { name: 'Magic 8-ball' }).getAttribute('href')).toBe('/fun/eight-ball');
  });

  it('renders generic referee cards with no licensed copy', () => {
    const { unmount } = render(
      <MemoryRouter>
        <YellowCardPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('yellow-card').textContent).toMatch(/yellow card/i);
    expect(screen.queryByText(/world cup|fifa|premier league/i)).toBeNull();
    unmount();
    render(
      <MemoryRouter>
        <RedCardPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('red-card').textContent).toMatch(/red card/i);
    expect(screen.queryByText(/world cup|fifa|premier league/i)).toBeNull();
  });

  it('picks an 8-ball answer from the fixed client-side list', async () => {
    expect(pickAnswer(EIGHT_BALL_ANSWERS, () => 0)).toBe(EIGHT_BALL_ANSWERS[0]);
    expect(EIGHT_BALL_ANSWERS).toHaveLength(20);
    render(
      <MemoryRouter>
        <EightBallPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('eight-ball-answer').textContent).toBe('Tap or shake');
    await userEvent.click(screen.getByTestId('eight-ball'));
    const shown = screen.getByTestId('eight-ball-answer').textContent ?? '';
    expect(EIGHT_BALL_ANSWERS).toContain(shown);
  });
});
