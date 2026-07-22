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
  await waitFor(() => expect(screen.getByLabelText(/nome de exibição/i)).toHaveValue('Alfredo'));
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
  const input = await screen.findByLabelText(/nome de exibição/i);
  fireEvent.change(input, { target: { value: 'Novo Nome' } });
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

  await waitFor(() => expect(patch).toHaveBeenCalledWith({ display_name: 'Novo Nome' }));
  await screen.findByText(/nome atualizado/i);
  expect(localStorage.getItem('username')).toBe('Novo Nome');
});

test('nome vazio mostra erro e não chama PATCH', async () => {
  const patch = jest.fn();
  mockFetch((url, opts) => {
    if (opts?.method === 'PATCH') { patch(); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({ username: 'a@b.com', display_name: '' }) };
  });
  render(<ProfilePage />);
  await screen.findByLabelText(/nome de exibição/i);
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

  await screen.findByRole('alert');
  expect(patch).not.toHaveBeenCalled();
});
