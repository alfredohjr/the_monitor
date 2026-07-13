import { render, screen, fireEvent } from '@testing-library/react';
import ClonarMetas from '@/components/goals/ClonarMetas';

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
    if (url.includes('/goals/clone')) {
      const body = JSON.parse((opts?.body as string) || '{}');
      if (body.dry_run) {
        return Promise.resolve({ ok: true, json: async () => ({ dry_run: true, criadas: 4, ignoradas: 1, soma: 110 }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ dry_run: false, criadas: 4, ignoradas: 1, soma: 110 }) });
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
  fireEvent.change(container.querySelector('input[name="origem_inicio"]')!, { target: { value: '2026-07-01' } });
  fireEvent.change(container.querySelector('input[name="origem_fim"]')!, { target: { value: '2026-07-04' } });
  fireEvent.change(container.querySelector('input[name="destino_inicio"]')!, { target: { value: '2026-08-01' } });
}

describe('ClonarMetas', () => {
  it('mostra a prévia (dry_run) com criadas, ignoradas e soma', async () => {
    const { container } = render(<ClonarMetas />);
    expect(await screen.findByRole('option', { name: 'Receita (daily)' })).toBeInTheDocument();
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));

    // texto quebrado por <strong>: casa o parágrafo pelo textContent
    expect(await screen.findByText((_, el) => el?.textContent === '4 meta(s) serão criada(s).')).toBeInTheDocument();
    expect(screen.getByText(/1 j[aá] existe/)).toBeInTheDocument();
  });

  it('confirma a clonagem e mostra o resultado', async () => {
    const { container } = render(<ClonarMetas />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));
    fireEvent.click(await screen.findByText('Confirmar clonagem'));

    expect(await screen.findByText(/4 meta\(s\) criada\(s\)/)).toBeInTheDocument();
  });

  it('envia escala no corpo da requisição', async () => {
    const { container } = render(<ClonarMetas />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.change(container.querySelector('input[name="escala"]')!, { target: { value: '1.1' } });
    fireEvent.click(screen.getByText('Pré-visualizar'));

    await screen.findByText(/ser[aã]o criada/);
    const calls = (global.fetch as jest.Mock).mock.calls;
    const cloneCall = calls.find((c) => String(c[0]).includes('/goals/clone'));
    expect(JSON.parse(cloneCall[1].body).escala).toBe(1.1);
  });
});
