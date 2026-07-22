import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const metricas = [
  { id: 1, codigo: 'PAD_RECEITA', nome: 'Receita do Dia', descricao: 'Faturamento diário', tipo: 'currency', periodo: 'daily', is_default: true, valor_padrao: '0' },
  { id: 2, codigo: 'PAD_ESTUDO', nome: 'Horas Estudadas', descricao: 'Horas de estudo', tipo: 'decimal', periodo: 'daily', is_default: true, valor_padrao: '0' },
];

function mockFetch(postOk = true) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    if (opts?.method === 'POST') {
      return Promise.resolve({ ok: postOk, status: postOk ? 201 : 400, json: async () => ({ id: 99 }) });
    }
    // Usuário já com organização: o onboarding vai direto ao passo de métricas.
    if (url.includes('/me/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ organizations: [{ id: 1, nome: 'Org', role: 'admin' }] }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => metricas });
  });
}

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('OnboardingFlow — auth guard', () => {
  it('redireciona para /login sem token', () => {
    localStorage.clear();
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<OnboardingFlow />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});

describe('OnboardingFlow — renderização', () => {
  it('exibe título de onboarding', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    expect(await screen.findByText(/bem-vindo|primeiros passos|configurar/i)).toBeInTheDocument();
  });

  it('lista as métricas padrão como checkboxes', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    expect(await screen.findByText('Receita do Dia')).toBeInTheDocument();
    expect(screen.getByText('Horas Estudadas')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('exibe botão "Começar"', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    expect(await screen.findByRole('button', { name: /começar/i })).toBeInTheDocument();
  });

  it('exibe link ou botão "Pular"', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    await screen.findByText('Receita do Dia');
    expect(screen.getByText(/pular/i)).toBeInTheDocument();
  });
});

describe('OnboardingFlow — interação', () => {
  it('Pular redireciona para /dashboard sem criar subscrições', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    await screen.findByText(/pular/i);
    fireEvent.click(screen.getByText(/pular/i));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    const fetchMock = (global as { fetch: jest.Mock }).fetch;
    const postCalls = fetchMock.mock.calls.filter((c: any[]) => c[1]?.method === 'POST');
    expect(postCalls.length).toBe(0);
  });

  it('Começar com métricas selecionadas chama /subscriptions/ e redireciona', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    await screen.findByText('Receita do Dia');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: /começar/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    const fetchMock = (global as { fetch: jest.Mock }).fetch;
    const postCalls = fetchMock.mock.calls.filter((c: any[]) => c[1]?.method === 'POST');
    expect(postCalls.length).toBe(1);
    expect(postCalls[0][0]).toContain('/subscriptions/');
    const body = JSON.parse(postCalls[0][1].body);
    expect(body).toHaveProperty('metric_id');
    expect(body).not.toHaveProperty('alvo');
  });

  it('Começar sem nenhuma seleção redireciona sem criar subscrições', async () => {
    mockFetch();
    render(<OnboardingFlow />);
    await screen.findByText('Receita do Dia');
    fireEvent.click(screen.getByRole('button', { name: /começar/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    const fetchMock = (global as { fetch: jest.Mock }).fetch;
    const postCalls = fetchMock.mock.calls.filter((c: any[]) => c[1]?.method === 'POST');
    expect(postCalls.length).toBe(0);
  });
});
