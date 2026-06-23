import { render, screen } from '@testing-library/react';
import Main from '../app/page';

describe('Main page', () => {
  it('renders the panel title', () => {
    render(<Main />);
    expect(screen.getByText('Painel 1')).toBeInTheDocument();
  });
});
