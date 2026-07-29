import { render, screen } from '@testing-library/react';
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
    expect(await screen.findByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Undo')).toBeInTheDocument();
  });

  it('lançador sem flags não vê botões', async () => {
    mock({ is_admin: false, user_id: 5, metrics: { '20': { can_edit: false, can_delete: false } } });
    render(<LogList />);
    // Âncora POSITIVA: espera a linha existir de fato. Antes esperava-se o estado
    // vazio sumir, e com isso a asserção seguinte (também negativa) passava
    // trivialmente numa tabela vazia — o teste diria "sem botões" mesmo se os
    // botões estivessem lá.
    expect(await screen.findByText('Métrica')).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Undo')).not.toBeInTheDocument();
  });

  it('lançador com can_edit no próprio lançamento vê só Editar', async () => {
    mock({ is_admin: false, user_id: 5, metrics: { '20': { can_edit: true, can_delete: false } } });
    render(<LogList />);
    expect(await screen.findByText('Edit')).toBeInTheDocument();
    expect(screen.queryByText('Undo')).not.toBeInTheDocument();
  });

  it('lançador com flag mas lançamento de OUTRO não vê botões', async () => {
    // autor do log é 5, mas o usuário logado é 9
    mock({ is_admin: false, user_id: 9, metrics: { '20': { can_edit: true, can_delete: true } } });
    render(<LogList />);
    // Âncora POSITIVA: espera a linha existir de fato. Antes esperava-se o estado
    // vazio sumir, e com isso a asserção seguinte (também negativa) passava
    // trivialmente numa tabela vazia — o teste diria "sem botões" mesmo se os
    // botões estivessem lá.
    expect(await screen.findByText('Métrica')).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Undo')).not.toBeInTheDocument();
  });
});
