import { render, screen, waitFor } from '@testing-library/react';
import LogList from '@/components/logs/LogList';
import LogForm from '@/components/logs/LogForm';
import { formatValor, placeholderValor } from '@/lib/formatValor';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

// --- formatValor (pura) ---

describe('formatValor', () => {
  it('formata currency com R$', () => {
    expect(formatValor('500', 'currency')).toMatch(/R\$.*500/);
  });

  it('formata percent com %', () => {
    expect(formatValor('75', 'percent')).toBe('75%');
  });

  it('retorna valor sem alteração para number', () => {
    expect(formatValor('42', 'number')).toBe('42');
  });

  it('retorna valor sem alteração para string', () => {
    expect(formatValor('ok', 'string')).toBe('ok');
  });

  it('retorna string vazia sem alteração', () => {
    expect(formatValor('', 'currency')).toBe('');
  });
});

describe('placeholderValor', () => {
  it('retorna placeholder para currency', () => {
    expect(placeholderValor('currency')).toMatch(/R\$|500/);
  });

  it('retorna placeholder para percent', () => {
    expect(placeholderValor('percent')).toMatch(/%|75/);
  });

  it('retorna placeholder genérico para outros tipos', () => {
    expect(placeholderValor('number')).toBeTruthy();
  });
});

// --- LogList integração ---

describe('LogList — formatação por tipo', () => {
  function mockFetch(tipo: string, valor: string) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/logs/'))    return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 1, goal: 10, data: '2026-06-28', valor_logado: valor }] });
      if (url.includes('/goals/'))   return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 10, metric: 20, periodo_referencia: '' }] });
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 20, codigo: 'M', nome: 'Métrica', tipo }] });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe valor com R$ para tipo currency', async () => {
    mockFetch('currency', '500');
    render(<LogList />);
    await waitFor(() => expect(screen.queryByText(/nenhum check-in/i)).not.toBeInTheDocument());
    expect(screen.getByText(/R\$.*500|500.*R\$/)).toBeInTheDocument();
  });

  it('exibe valor com % para tipo percent', async () => {
    mockFetch('percent', '75');
    render(<LogList />);
    await waitFor(() => expect(screen.queryByText(/nenhum check-in/i)).not.toBeInTheDocument());
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('exibe valor sem formatação para tipo number', async () => {
    mockFetch('number', '42');
    render(<LogList />);
    await waitFor(() => expect(screen.queryByText(/nenhum check-in/i)).not.toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

// --- LogForm integração ---

describe('LogForm — placeholder por tipo', () => {
  it('mostra placeholder padrão sem meta selecionada', () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<LogForm />);
    const input = screen.getByPlaceholderText(/ex:/i);
    expect(input).toBeInTheDocument();
  });
});
