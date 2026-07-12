import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportGoals from '@/components/goals/ImportGoals';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const metrica = { id: 1, codigo: 'REC', nome: 'Receita', tipo: 'currency', periodo: 'daily' };

beforeEach(() => {
  localStorage.setItem('access_token', 'tok');
  mockPush.mockClear();
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/metrics/')) return Promise.resolve({ ok: true, json: async () => [metrica] });
    if (url.includes('/goals/import')) {
      const body = JSON.parse((opts?.body as string) || '{}');
      if (body.dry_run) {
        return Promise.resolve({ ok: true, json: async () => ({
          dry_run: true,
          pontos: [
            { data: '2026-08-03', alvo: 25 },
            { data: '2026-08-04', alvo: 25 },
            { data: '2026-08-05', alvo: 25 },
            { data: '2026-08-06', alvo: 25 },
          ],
          soma: 100,
        }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ dry_run: false, criadas: 4, ignoradas: 0, soma: 100 }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

function preencher(container: HTMLElement) {
  fireEvent.change(container.querySelector('select[name="metric_id"]')!, { target: { value: '1' } });
  fireEvent.change(container.querySelector('input[name="alvo_total"]')!, { target: { value: '100' } });
  fireEvent.change(container.querySelector('input[name="inicio"]')!, { target: { value: '2026-08-03' } });
  fireEvent.change(container.querySelector('input[name="fim"]')!, { target: { value: '2026-08-06' } });
}

describe('ImportGoals', () => {
  it('mostra a prévia (dry_run) com soma e pontos', async () => {
    const { container } = render(<ImportGoals />);
    expect(await screen.findByRole('option', { name: 'Receita (daily)' })).toBeInTheDocument();
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));

    expect(await screen.findByText(/Prévia — 4 dia/)).toBeInTheDocument();
    expect(screen.getByText('2026-08-03')).toBeInTheDocument();
    // soma exibida
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('confirma a importação e mostra o resultado', async () => {
    const { container } = render(<ImportGoals />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));
    fireEvent.click(await screen.findByText('Confirmar importação'));

    expect(await screen.findByText(/4 meta\(s\) criada\(s\)/)).toBeInTheDocument();
  });
});

describe('ImportGoals — prefill por modelo (#143)', () => {
  const template = { id: 9, nome: 'Meta de receita', metric_codigo: 'REC', alvo_sugerido: '500', estrategia: 'rampa_crescente' };

  beforeEach(() => {
    localStorage.setItem('access_token', 'tok');
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/goal-templates/')) return Promise.resolve({ ok: true, json: async () => [template] });
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, json: async () => [metrica] });
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  });

  it('clicar no modelo pré-preenche métrica, alvo e curva', async () => {
    const { container } = render(<ImportGoals />);
    fireEvent.click(await screen.findByText('Meta de receita'));
    expect((container.querySelector('select[name="metric_id"]') as HTMLSelectElement).value).toBe('1');
    expect((container.querySelector('input[name="alvo_total"]') as HTMLInputElement).value).toBe('500');
    expect((container.querySelector('select[name="estrategia"]') as HTMLSelectElement).value).toBe('rampa_crescente');
  });
});
