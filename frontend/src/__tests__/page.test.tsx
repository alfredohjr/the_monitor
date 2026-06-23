import { render, screen } from '@testing-library/react';
import Main from '../app/page';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([]) } as Response)
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Main page', () => {
  it('renders the panel title', () => {
    render(<Main />);
    expect(screen.getByText('Painel 1')).toBeInTheDocument();
  });
});
