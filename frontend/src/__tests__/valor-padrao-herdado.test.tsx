import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GoalForm from '@/components/goals/GoalForm';
import LogForm from '@/components/logs/LogForm';
import MetricList from '@/components/metrics/MetricList';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: '1' }),
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

// --- GoalForm ---

describe('GoalForm — pré-preenche alvo com valor_padrao da métrica', () => {
  it('preenche o campo alvo com valor_padrao ao selecionar a métrica', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [
        { id: 1, codigo: 'M', nome: 'Receita', tipo: 'currency', periodo: 'daily', valor_padrao: '1000' }
      ]});
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<GoalForm />);
    await screen.findByText('Receita (daily)');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1', name: 'metric' } });
    const input = await screen.findByLabelText(/alvo/i) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('1000'));
  });

  it('não preenche alvo quando valor_padrao é null', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [
        { id: 2, codigo: 'P', nome: 'Peso', tipo: 'decimal', periodo: 'daily', valor_padrao: null }
      ]});
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<GoalForm />);
    await screen.findByText('Peso (daily)');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2', name: 'metric' } });
    const input = await screen.findByLabelText(/alvo/i) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe(''));
  });
});

// --- LogForm ---

describe('LogForm — placeholder com valor_padrao da métrica', () => {
  it('inclui valor_padrao no placeholder do campo valor_logado quando a meta tem métrica com valor_padrao', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/goals/'))   return Promise.resolve({ ok: true, status: 200, json: async () => [
        { id: 10, metric: 20, periodo_referencia: '2026-06' }
      ]});
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [
        { id: 20, codigo: 'M', nome: 'Receita', tipo: 'currency', periodo: 'monthly', valor_padrao: '500' }
      ]});
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<LogForm />);
    await screen.findByText(/Receita/i);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '10', name: 'goal' } });
    const input = await screen.findByPlaceholderText(/500|R\$/i);
    expect(input).toBeInTheDocument();
  });
});

// --- MetricList ---

describe('MetricList — exibe valor_padrao formatado', () => {
  it('exibe valor_padrao de métrica currency formatado com R$', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 1, codigo: 'R', nome: 'Receita', descricao: 'desc', tipo: 'currency', periodo: 'daily', is_default: false, valor_padrao: '500' }],
    });
    render(<MetricList />);
    await screen.findByText('Receita');
    expect(screen.getByText(/R\$.*500|500.*R\$/)).toBeInTheDocument();
  });

  it('exibe valor_padrao de métrica percent com %', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 2, codigo: 'T', nome: 'Taxa', descricao: 'desc', tipo: 'percent', periodo: 'monthly', is_default: false, valor_padrao: '10' }],
    });
    render(<MetricList />);
    await screen.findByText('Taxa');
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('exibe traço quando valor_padrao é null', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 3, codigo: 'P', nome: 'Peso', descricao: 'desc', tipo: 'decimal', periodo: 'daily', is_default: false, valor_padrao: null }],
    });
    render(<MetricList />);
    await screen.findByText('Peso');
    expect(screen.getByTestId('valor-padrao-3').textContent).toBe('—');
  });
});
