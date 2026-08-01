import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Navbar from '@/components/layout/Navbar';
import { getMoedaAtiva } from '@/lib/formatValor';
import { getActiveOrg, setActiveOrg } from '@/lib/api';

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
    const select = await screen.findByLabelText('Organization');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('define a primeira org como ativa quando nenhuma está selecionada', async () => {
    mockMe(twoOrgs);
    render(<Navbar />);
    await screen.findByLabelText('Organization');
    await waitFor(() => expect(getActiveOrg()).toBe(7));
  });

  it('trocar no seletor atualiza a org ativa', async () => {
    // reload não existe no jsdom; substitui por no-op
    const reload = jest.fn();
    Object.defineProperty(window, 'location', { value: { reload }, writable: true });
    mockMe(twoOrgs);
    render(<Navbar />);
    const select = await screen.findByLabelText('Organization');
    fireEvent.change(select, { target: { value: '9' } });
    expect(getActiveOrg()).toBe(9);
    // O reload passou a esperar a limpeza do cache da API (#325), então não é
    // mais síncrono ao evento. A ORDEM é o ponto: recarregar antes de limpar
    // deixaria a tela nova ler dado da org anterior.
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('não mostra o seletor sem organizações', async () => {
    mockMe({ id: 1, username: 'ana', role: 'user', organizations: [] });
    render(<Navbar />);
    await waitFor(() => expect(screen.getByText(/Hi/)).toBeInTheDocument());
    expect(screen.queryByLabelText('Organization')).not.toBeInTheDocument();
  });
});

describe('Navbar — moeda da org ativa (#309)', () => {
  const orgsComMoeda = {
    role: 'admin',
    organizations: [
      { id: 7, nome: 'Acme', role: 'admin', moeda: 'USD' },
      { id: 9, nome: 'Outra', role: 'admin', moeda: 'EUR' },
    ],
  };

  it('grava a moeda da org ativa para o formatValor usar', async () => {
    localStorage.setItem('access_token', 'tok');
    // mockMe responde [] para as outras rotas: o NotificationBell renderizado
    // dentro do Navbar espera lista e quebra com um objeto.
    mockMe(orgsComMoeda);
    render(<Navbar />);
    await waitFor(() => expect(getMoedaAtiva()).toBe('USD'));
  });

  it('trocar de organização troca a moeda junto', async () => {
    // Sem isso, os valores da org nova apareceriam com o símbolo da anterior —
    // o número certo com a moeda errada, que é pior que um erro visível.
    localStorage.setItem('access_token', 'tok');
    setActiveOrg(7);
    mockMe(orgsComMoeda);
    render(<Navbar />);
    await waitFor(() => expect(getMoedaAtiva()).toBe('USD'));

    fireEvent.change(await screen.findByLabelText(/organization/i), { target: { value: '9' } });
    await waitFor(() => expect(getMoedaAtiva()).toBe('EUR'));
  });
});
