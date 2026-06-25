import { render } from '@testing-library/react';
import LoginPage from '../app/login/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('Login page layout', () => {
  it('reserves top space so the card does not overlap the fixed navbar', () => {
    const { container } = render(<LoginPage />);
    const root = container.firstChild as HTMLElement;
    // O Navbar é absoluto/flutuante no topo; a página precisa de padding-top
    // suficiente para o card centralizado nunca colidir com o menu.
    expect(root.className).toMatch(/pt-28/);
  });
});
