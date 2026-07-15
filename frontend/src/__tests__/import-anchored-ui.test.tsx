import { render, screen, fireEvent } from '@testing-library/react';
import ImportAnchored from '@/components/goals/ImportAnchored';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const metrica = { id: 1, codigo: 'REC', nome: 'Receita', periodo: 'daily' };
const indice = { code: 'IPCA', nome: 'IPCA (inflação)' };

beforeEach(() => {
  localStorage.setItem('access_token', 'tok');
  mockPush.mockClear();
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/external-indices/')) return Promise.resolve({ ok: true, json: async () => [indice] });
    if (url.includes('/metrics/')) return Promise.resolve({ ok: true, json: async () => [metrica] });
    if (url.includes('/goals/import-anchored')) {
      const body = JSON.parse((opts?.body as string) || '{}');
      if (body.dry_run) {
        return Promise.resolve({ ok: true, json: async () => ({
          dry_run: true, alvo_base: 100, alvo_corrigido: 110, soma: 110,
          pontos: [{ data: '2026-01-01', alvo: 22 }, { data: '2026-01-02', alvo: 22 }],
        }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ dry_run: false, anchor_id: 3, alvo_corrigido: 110, criadas: 2, ignoradas: 0, soma: 110 }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
});

afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

function preencher(container: HTMLElement) {
  fireEvent.change(container.querySelector('select[name="metric_id"]')!, { target: { value: '1' } });
  fireEvent.change(container.querySelector('select[name="index_code"]')!, { target: { value: 'IPCA' } });
  fireEvent.change(container.querySelector('input[name="alvo_base"]')!, { target: { value: '100' } });
  fireEvent.change(container.querySelector('input[name="inicio"]')!, { target: { value: '2026-01-01' } });
  fireEvent.change(container.querySelector('input[name="fim"]')!, { target: { value: '2026-01-02' } });
}

describe('ImportAnchored', () => {
  it('mostra a prévia com alvo corrigido', async () => {
    const { container } = render(<ImportAnchored />);
    expect(await screen.findByRole('option', { name: 'IPCA (inflação)' })).toBeInTheDocument();
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));
    expect(await screen.findByText(/Prévia — 2 dia/)).toBeInTheDocument();
    // alvo corrigido 110 aparece (no rótulo "Alvo corrigido" e na soma)
    expect(screen.getAllByText('110').length).toBeGreaterThan(0);
  });

  it('confirma a importação ancorada', async () => {
    const { container } = render(<ImportAnchored />);
    await screen.findByRole('option', { name: 'IPCA (inflação)' });
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));
    fireEvent.click(await screen.findByText('Confirmar importação'));
    expect(await screen.findByText(/2 meta\(s\) criada\(s\)/)).toBeInTheDocument();
  });
});
