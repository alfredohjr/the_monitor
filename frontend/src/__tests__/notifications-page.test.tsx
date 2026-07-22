import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationsPage from '@/components/notifications/NotificationsPage';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/notificacoes',
}));

const lista = [
  { id: 1, mensagem: 'Meta atingida', lida: false, created_at: '2026-07-20T10:00:00Z' },
  { id: 2, mensagem: 'Bem-vindo', lida: true, created_at: '2026-07-19T10:00:00Z' },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('access_token', 'tok');
  mockPush.mockClear();
});
afterEach(() => { delete (global as { fetch?: unknown }).fetch; });

test('lista todas as notificações (lidas e não lidas)', async () => {
  (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => lista });
  render(<NotificationsPage />);
  expect(await screen.findByText('Meta atingida')).toBeInTheDocument();
  expect(screen.getByText('Bem-vindo')).toBeInTheDocument();
});

test('marcar como lida chama a API e atualiza o item', async () => {
  const read = jest.fn();
  (global as { fetch: unknown }).fetch = jest.fn((url: string, opts?: RequestInit) => {
    if (opts?.method === 'POST') { read(url); return Promise.resolve({ ok: true, json: async () => ({ id: 1, lida: true }) }); }
    return Promise.resolve({ ok: true, json: async () => lista });
  });
  render(<NotificationsPage />);
  const btn = await screen.findByRole('button', { name: /marcar.*lida|meta atingida/i });
  fireEvent.click(btn);
  await waitFor(() => expect(read).toHaveBeenCalledWith(expect.stringContaining('/notifications/1/read/')));
});

test('estado vazio quando não há notificações', async () => {
  (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  render(<NotificationsPage />);
  expect(await screen.findByText(/nenhuma notificação/i)).toBeInTheDocument();
});

test('redireciona para /login sem token', () => {
  localStorage.clear();
  (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  render(<NotificationsPage />);
  expect(mockReplace).toHaveBeenCalledWith('/login');
});
