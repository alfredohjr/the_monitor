import { render, screen, fireEvent } from '@testing-library/react';
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
    // Espera o DADO aparecer, não o estado vazio sumir: o matcher do vazio em
    // português virou no-op com a tela em inglês, e o waitFor resolvia antes do
    // fetch, testando uma tabela vazia.
    expect(await screen.findByText(/R\$.*1\.000|R\$.*1000/)).toBeInTheDocument();
  });

  it('exibe alvo com % para tipo percent', async () => {
    mockFetch('percent', '90');
    render(<GoalList />);
    expect(await screen.findByText('90%')).toBeInTheDocument();
  });

  it('exibe alvo sem formatação para tipo number', async () => {
    mockFetch('number', '42');
    render(<GoalList />);
    expect(await screen.findByText('42')).toBeInTheDocument();
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

describe('Metas — idioma (#288)', () => {
  it('GoalList renderiza em pt-BR quando o locale está salvo', async () => {
    localStorage.setItem('locale', 'pt-BR');
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<GoalList />);
    expect(await screen.findByText('Suas Metas (Goals) Ativas')).toBeInTheDocument();
    expect(screen.getByText('Nenhum desafio ou fatia de meta ativa.')).toBeInTheDocument();
  });

  it('GoalForm usa a pergunta de período completa, não concatenada', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 1, codigo: 'M', nome: 'Métrica', tipo: 'number', periodo: 'weekly' }],
    });
    render(<GoalForm />);
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });
    expect(await screen.findByText('Which exact week will you measure?')).toBeInTheDocument();
  });
});
