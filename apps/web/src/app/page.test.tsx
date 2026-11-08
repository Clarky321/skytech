import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  afterEach(cleanup);

  it('renders the site heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'SkyTech.ru' })).toBeDefined();
  });
});
