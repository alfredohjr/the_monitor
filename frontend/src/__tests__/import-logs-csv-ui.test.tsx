import { render, screen, fireEvent } from '@testing-library/react';
import ImportLogsCSV from '@/components/logs/ImportLogsCSV';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const metrica = { id: 1, codigo: 'REC', nome: 'Receita', periodo: 'daily' };

beforeEach(() => {
  localStorage.setItem('access_token', 'tok');
  mockPush.mockClear();
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/metrics/')) return Promise.resolve({ ok: true, json: async () => [metrica] });
    if (url.includes('/logs/import-csv')) {
      const body = JSON.parse((opts?.body as string) || '{}');
      const resumo = { criadas: 2, ignoradas: 0, sem_meta: 1, erros: [{ linha: 2, motivo: "esperado 'data,valor'" }] };
      return Promise.resolve({ ok: true, json: async () => ({ dry_run: body.dry_run, ...resumo }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
});

afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

function preencher(container: HTMLElement) {
  fireEvent.change(container.querySelector('select[name="metric_id"]')!, { target: { value: '1' } });
  fireEvent.change(container.querySelector('textarea[name="csv"]')!, { target: { value: '2026-08-03,5\nlixo\n2026-08-04,7' } });
}

describe('ImportLogsCSV', () => {
  it('prévia mostra contagem e erros por linha', async () => {
    const { container } = render(<ImportLogsCSV />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));

    expect(await screen.findByText(/esperado 'data,valor'/)).toBeInTheDocument();
    expect(screen.getByText('Confirmar importação')).toBeInTheDocument();  // preview habilita confirmar
  });

  it('confirma e mostra o resultado', async () => {
    const { container } = render(<ImportLogsCSV />);
    await screen.findByRole('option', { name: 'Receita (daily)' });
    preencher(container);
    fireEvent.click(screen.getByText('Pré-visualizar'));
    fireEvent.click(await screen.findByText('Confirmar importação'));

    expect(await screen.findByText(/2 criada\(s\)/)).toBeInTheDocument();
  });
});
