import { render, screen, waitFor } from '@testing-library/react';
import GoalList from '@/components/goals/GoalList';
import GoalForm from '@/components/goals/GoalForm';

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

// --- GoalList ---

describe('GoalList — formatação do alvo por tipo', () => {
  function mockFetch(tipo: string, alvo: string) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/goals/'))   return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 1, metric: 10, alvo, periodo_referencia: '2026-06' }] });
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 10, codigo: 'M', nome: 'Métrica', tipo }] });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe alvo com R$ para tipo currency', async () => {
    mockFetch('currency', '1000');
    render(<GoalList />);
    await waitFor(() => expect(screen.queryByText(/nenhum desafio/i)).not.toBeInTheDocument());
    expect(screen.getByText(/R\$.*1\.000|R\$.*1000/)).toBeInTheDocument();
  });

  it('exibe alvo com % para tipo percent', async () => {
    mockFetch('percent', '90');
    render(<GoalList />);
    await waitFor(() => expect(screen.queryByText(/nenhum desafio/i)).not.toBeInTheDocument());
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('exibe alvo sem formatação para tipo number', async () => {
    mockFetch('number', '42');
    render(<GoalList />);
    await waitFor(() => expect(screen.queryByText(/nenhum desafio/i)).not.toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

// --- GoalForm ---

describe('GoalForm — placeholder do alvo por tipo', () => {
  it('mostra campo alvo com placeholder genérico sem métrica selecionada', () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<GoalForm />);
    const input = screen.getByLabelText(/alvo/i);
    expect(input).toBeInTheDocument();
  });
});
