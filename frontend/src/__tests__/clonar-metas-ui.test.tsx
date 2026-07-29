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
    fireEvent.click(screen.getByText('Preview'));

    // texto quebrado por <strong>: casa o parágrafo pelo textContent
    expect(await screen.findByText((_, el) => el?.textContent === '4 goal(s) will be created.')).toBeInTheDocument();
    expect(screen.getByText(/1 already exist/)).toBeInTheDocument();
  });

  it('confirma a clonagem e mostra o resultado', async () => {
    const { container } = render(<ClonarMetas />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.click(screen.getByText('Preview'));
    fireEvent.click(await screen.findByText('Confirm cloning'));

    expect(await screen.findByText(/4 goal\(s\) created/)).toBeInTheDocument();
  });

  it('envia escala no corpo da requisição', async () => {
    const { container } = render(<ClonarMetas />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.change(container.querySelector('input[name="escala"]')!, { target: { value: '1.1' } });
    fireEvent.click(screen.getByText('Preview'));

    await screen.findByText(/will be created/);
    const calls = (global.fetch as jest.Mock).mock.calls;
    const cloneCall = calls.find((c) => String(c[0]).includes('/goals/clone'));
    expect(JSON.parse(cloneCall[1].body).escala).toBe(1.1);
  });
});

describe('ClonarMetas — idioma (#291)', () => {
  it('renderiza em pt-BR e interpola a prévia como frase única', async () => {
    localStorage.setItem('locale', 'pt-BR');
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/goals/clone')) {
        const body = JSON.parse((opts!.body as string) || '{}');
        return Promise.resolve({ ok: true, json: async () => ({ criadas: body.dry_run ? 4 : 4, ignoradas: 1, soma: 400 }) });
      }
      return Promise.resolve({ ok: true, json: async () => [{ id: 1, codigo: 'REC', nome: 'Receita', periodo: 'daily' }] });
    });
    render(<ClonarMetas />);
    expect(await screen.findByText('Clonar metas')).toBeInTheDocument();
    expect(screen.getByText('Origem — início')).toBeInTheDocument();
    // reusada de goalsImport
    expect(screen.getByText('← Voltar pra Metas')).toBeInTheDocument();
  });
});
