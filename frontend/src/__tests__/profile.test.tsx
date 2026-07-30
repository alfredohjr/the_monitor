import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePage from '@/components/profile/ProfilePage';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/perfil',
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('access_token', 'tok');
  mockPush.mockClear();
});

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

function mockFetch(handlers: (url: string, opts?: RequestInit) => unknown) {
  (global as { fetch: unknown }).fetch = jest.fn((url: string, opts?: RequestInit) =>
    Promise.resolve(handlers(url, opts))
  );
}

test('carrega o display_name atual do /me', async () => {
  mockFetch(() => ({ ok: true, json: async () => ({ username: 'a@b.com', email: 'a@b.com', display_name: 'Alfredo' }) }));
  render(<ProfilePage />);
  await waitFor(() => expect(screen.getByLabelText(/display name/i)).toHaveValue('Alfredo'));
});

test('salva o novo nome via PATCH e confirma', async () => {
  const patch = jest.fn();
  mockFetch((url, opts) => {
    if (opts?.method === 'PATCH') {
      patch(JSON.parse(opts.body as string));
      return { ok: true, json: async () => ({ display_name: 'Novo Nome' }) };
    }
    return { ok: true, json: async () => ({ username: 'a@b.com', display_name: '' }) };
  });
  render(<ProfilePage />);
  const input = await screen.findByLabelText(/display name/i);
  fireEvent.change(input, { target: { value: 'Novo Nome' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => expect(patch).toHaveBeenCalledWith({ display_name: 'Novo Nome' }));
  await screen.findByText(/name updated/i);
  expect(localStorage.getItem('username')).toBe('Novo Nome');
});

test('nome vazio mostra erro e não chama PATCH', async () => {
  const patch = jest.fn();
  mockFetch((url, opts) => {
    if (opts?.method === 'PATCH') { patch(); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({ username: 'a@b.com', display_name: '' }) };
  });
  render(<ProfilePage />);
  await screen.findByLabelText(/display name/i);
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await screen.findByRole('alert');
  expect(patch).not.toHaveBeenCalled();
});

describe('Perfil — idioma (#297)', () => {
  it('renderiza em pt-BR quando o locale está salvo', async () => {
    localStorage.setItem('locale', 'pt-BR');
    mockFetch(() => ({ ok: true, json: async () => ({ username: 'a@b.com', email: 'a@b.com', display_name: 'Alfredo' }) }));
    render(<ProfilePage />);
    expect(await screen.findByLabelText(/nome de exibição/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });
});

describe('Perfil — idioma no servidor (#304)', () => {
  afterEach(() => localStorage.clear());

  it('adota o locale que veio do /me, tratando o servidor como fonte de verdade', async () => {
    // Sem isso, quem trocou de idioma noutro dispositivo voltaria ao padrão aqui.
    mockFetch(() => ({ ok: true, json: async () => ({ username: 'a', email: null, display_name: 'A', locale: 'pt-BR' }) }));
    render(<ProfilePage />);
    await screen.findByDisplayValue('A');
    await waitFor(() => expect(localStorage.getItem('locale')).toBe('pt-BR'));
  });

  it('trocar o idioma manda PATCH com locale e persiste local', async () => {
    const chamadas: unknown[] = [];
    mockFetch((url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') {
        chamadas.push(JSON.parse(opts.body as string));
        return { ok: true, json: async () => ({ username: 'a', display_name: 'A', locale: 'pt-BR' }) };
      }
      return { ok: true, json: async () => ({ username: 'a', email: null, display_name: 'A', locale: 'en' }) };
    });
    render(<ProfilePage />);
    // Espera o /me resolver ANTES de interagir: o select é estático e renderiza
    // no primeiro passe, então mexer nele antes da carga faz o efeito
    // sobrescrever a escolha. Ancorar no dado é o que reproduz o uso real.
    await screen.findByDisplayValue('A');
    fireEvent.change(screen.getByLabelText(/language|idioma/i), { target: { value: 'pt-BR' } });

    await waitFor(() => expect(chamadas).toContainEqual({ locale: 'pt-BR' }));
    await waitFor(() => expect(localStorage.getItem('locale')).toBe('pt-BR'));
  });
});
