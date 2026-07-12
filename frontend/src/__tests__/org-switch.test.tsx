import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Navbar from '@/components/layout/Navbar';
import { getActiveOrg } from '@/lib/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const twoOrgs = {
  id: 1,
  username: 'ana',
  role: 'admin',
  organizations: [
    { id: 7, nome: 'Acme', role: 'admin' },
    { id: 9, nome: 'Beta', role: 'user' },
  ],
};

function mockMe(me: unknown) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) =>
    url.includes('/me/')
      ? Promise.resolve({ ok: true, json: async () => me })
      : Promise.resolve({ ok: true, json: async () => [] })
  );
}

beforeEach(() => { localStorage.setItem('access_token', 'tok'); localStorage.setItem('username', 'ana'); });
afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

describe('Navbar — switch de organização', () => {
  it('mostra as organizações do usuário no seletor', async () => {
    mockMe(twoOrgs);
    render(<Navbar />);
    const select = await screen.findByLabelText('Organização');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('define a primeira org como ativa quando nenhuma está selecionada', async () => {
    mockMe(twoOrgs);
    render(<Navbar />);
    await screen.findByLabelText('Organização');
    await waitFor(() => expect(getActiveOrg()).toBe(7));
  });

  it('trocar no seletor atualiza a org ativa', async () => {
    // reload não existe no jsdom; substitui por no-op
    const reload = jest.fn();
    Object.defineProperty(window, 'location', { value: { reload }, writable: true });
    mockMe(twoOrgs);
    render(<Navbar />);
    const select = await screen.findByLabelText('Organização');
    fireEvent.change(select, { target: { value: '9' } });
    expect(getActiveOrg()).toBe(9);
    expect(reload).toHaveBeenCalled();
  });

  it('não mostra o seletor sem organizações', async () => {
    mockMe({ id: 1, username: 'ana', role: 'user', organizations: [] });
    render(<Navbar />);
    await waitFor(() => expect(screen.getByText(/Olá/)).toBeInTheDocument());
    expect(screen.queryByLabelText('Organização')).not.toBeInTheDocument();
  });
});
