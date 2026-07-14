import { render, screen, waitFor } from '@testing-library/react';
import LogList from '@/components/logs/LogList';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// 1 lançamento (goal 10 → métrica 20), autor = user 5.
function mock(perms: any) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/me/log-permissions/')) return Promise.resolve({ ok: true, json: async () => perms });
    if (url.includes('/logs/')) return Promise.resolve({ ok: true, json: async () => [{ id: 1, goal: 10, data: '2026-06-28', valor_logado: '42', created_by: 5 }] });
    if (url.includes('/goals/')) return Promise.resolve({ ok: true, json: async () => [{ id: 10, metric: 20, periodo_referencia: '' }] });
    if (url.includes('/metrics/')) return Promise.resolve({ ok: true, json: async () => [{ id: 20, codigo: 'M', nome: 'Métrica', tipo: 'number' }] });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

beforeEach(() => { localStorage.setItem('access_token', 'tok'); mockPush.mockClear(); });
afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

describe('LogList — botões condicionais à permissão (#164)', () => {
  it('admin vê Editar e Desfazer', async () => {
    mock({ is_admin: true, user_id: 1, metrics: {} });
    render(<LogList />);
    expect(await screen.findByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Desfazer')).toBeInTheDocument();
  });

  it('lançador sem flags não vê botões', async () => {
    mock({ is_admin: false, user_id: 5, metrics: { '20': { can_edit: false, can_delete: false } } });
    render(<LogList />);
    await waitFor(() => expect(screen.queryByText(/nenhum check-in/i)).not.toBeInTheDocument());
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Desfazer')).not.toBeInTheDocument();
  });

  it('lançador com can_edit no próprio lançamento vê só Editar', async () => {
    mock({ is_admin: false, user_id: 5, metrics: { '20': { can_edit: true, can_delete: false } } });
    render(<LogList />);
    expect(await screen.findByText('Editar')).toBeInTheDocument();
    expect(screen.queryByText('Desfazer')).not.toBeInTheDocument();
  });

  it('lançador com flag mas lançamento de OUTRO não vê botões', async () => {
    // autor do log é 5, mas o usuário logado é 9
    mock({ is_admin: false, user_id: 9, metrics: { '20': { can_edit: true, can_delete: true } } });
    render(<LogList />);
    await waitFor(() => expect(screen.queryByText(/nenhum check-in/i)).not.toBeInTheDocument());
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Desfazer')).not.toBeInTheDocument();
  });
});
