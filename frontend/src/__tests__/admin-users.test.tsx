import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminUsers from '@/components/admin/AdminUsers';
import Navbar from '@/components/layout/Navbar';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/',
}));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => { localStorage.setItem('access_token', 'tok'); localStorage.setItem('username', 'admin'); mockPush.mockClear(); });
afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

function mockApi({ me, users, onPost, onDelete }: any) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => me });
    if (url.match(/\/users\/\d+\/$/) && opts?.method === 'DELETE') return (onDelete ?? jest.fn())(url) ?? Promise.resolve({ ok: true, json: async () => ({}) });
    if (url.includes('/users/') && opts?.method === 'POST') return (onPost ?? jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })))(url, opts);
    if (url.includes('/users/')) return Promise.resolve({ ok: true, json: async () => users });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

const adminMe = { id: 1, username: 'admin', role: 'admin', organizations: [{ id: 7, nome: 'Acme', role: 'admin' }] };

describe('AdminUsers', () => {
  it('redireciona para /login sem token', () => {
    localStorage.clear();
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    render(<AdminUsers />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('lista os usuários da organização do admin', async () => {
    mockApi({ me: adminMe, users: [
      { id: 1, username: 'admin', email: 'a@x.com', role: 'admin' },
      { id: 2, username: 'colab', email: null, role: 'user' },
    ]});
    render(<AdminUsers />);
    expect(await screen.findByText('colab')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('adiciona um membro só com e-mail via POST', async () => {
    const onPost = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    mockApi({ me: adminMe, users: [], onPost });
    render(<AdminUsers />);
    await screen.findByText('Adicionar');
    fireEvent.change(screen.getByPlaceholderText('E-mail do novo membro'), { target: { value: 'novo@x.com' } });
    fireEvent.click(screen.getByText('Adicionar'));
    await waitFor(() => expect(onPost).toHaveBeenCalled());
    const body = JSON.parse((onPost.mock.calls[0][1] as RequestInit).body as string);
    expect(body.email).toBe('novo@x.com');
    expect(body.username).toBeUndefined();
    expect(body.password).toBeUndefined();
    expect(onPost.mock.calls[0][0]).toContain('/organizations/7/users/');
  });

  it('remove um usuário via DELETE (exceto a si mesmo)', async () => {
    const onDelete = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    mockApi({ me: adminMe, users: [
      { id: 1, username: 'admin', email: null, role: 'admin' },
      { id: 2, username: 'colab', email: null, role: 'user' },
    ], onDelete });
    render(<AdminUsers />);
    await screen.findByText('colab');
    // admin (id 1 = ele mesmo) não tem botão remover
    expect(screen.getAllByText('Remover')).toHaveLength(1);
    fireEvent.click(screen.getByText('Remover'));
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onDelete.mock.calls[0][0]).toContain('/organizations/7/users/2/');
  });

  it('mostra acesso restrito para não-admin', async () => {
    mockApi({ me: { id: 5, username: 'user', role: 'user', organizations: [] }, users: [] });
    render(<AdminUsers />);
    expect(await screen.findByText(/acesso restrito/i)).toBeInTheDocument();
  });

  it('atribui métricas a um lançador (carrega, alterna e salva via PUT) (#163)', async () => {
    const putCall = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ metric_ids: [10, 11] }) }));
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => adminMe });
      // atribuições do lançador (checar antes de /metrics/ genérico)
      if (url.match(/\/users\/2\/metrics\/$/)) {
        if (opts?.method === 'PUT') return putCall(url, opts);
        return Promise.resolve({ ok: true, json: async () => ({
          metric_ids: [10],
          assignments: [{ metric_id: 10, can_edit: false, can_delete: false }],
        }) });
      }
      if (url.endsWith('/api/v1/metrics/')) return Promise.resolve({ ok: true, json: async () => [
        { id: 10, codigo: 'M1', nome: 'Receita' },
        { id: 11, codigo: 'M2', nome: 'Custo' },
      ] });
      if (url.includes('/users/')) return Promise.resolve({ ok: true, json: async () => [
        { id: 1, username: 'admin', email: null, role: 'admin' },
        { id: 2, username: 'colab', email: null, role: 'user' },
      ] });
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<AdminUsers />);
    fireEvent.click(await screen.findByText('Métricas'));

    // painel abre com M1 marcada (atribuída) e M2 desmarcada
    const receita = await screen.findByLabelText('Receita') as HTMLInputElement;
    const custo = screen.getByLabelText('Custo') as HTMLInputElement;
    expect(receita.checked).toBe(true);
    expect(custo.checked).toBe(false);

    fireEvent.click(custo); // adiciona M2
    fireEvent.click(screen.getByText('Salvar métricas'));

    await waitFor(() => expect(putCall).toHaveBeenCalled());
    const body = JSON.parse((putCall.mock.calls[0][1] as RequestInit).body as string);
    const ids = body.assignments.map((a: { metric_id: number }) => a.metric_id);
    expect(new Set(ids)).toEqual(new Set([10, 11]));
    expect(putCall.mock.calls[0][0]).toContain('/organizations/7/users/2/metrics/');
  });
});

function mockMe(role: string) {
  // /me/ retorna o papel; demais endpoints (ex.: notificações) retornam lista.
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) =>
    url.includes('/me/')
      ? Promise.resolve({ ok: true, json: async () => ({ role, organizations: [] }) })
      : Promise.resolve({ ok: true, json: async () => [] })
  );
}

describe('Navbar — RBAC por papel', () => {
  it('esconde Dashboard/Metas/Métricas para papel user, mantém Lançamentos', async () => {
    mockMe('user');
    render(<Navbar />);
    await waitFor(() => expect(screen.queryByText('Dashboard')).not.toBeInTheDocument());
    expect(screen.getByText('Lançamentos')).toBeInTheDocument();
    expect(screen.queryByText('Metas')).not.toBeInTheDocument();
    expect(screen.queryByText('Métricas')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('mostra o link Admin para papel admin', async () => {
    mockMe('admin');
    render(<Navbar />);
    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });
});
