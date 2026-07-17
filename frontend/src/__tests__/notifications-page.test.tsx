import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NotificationsPage from '@/components/notifications/NotificationsPage';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let currentNotifs: object[] = [];

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
  currentNotifs = [];
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/read/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (url.includes('/notifications/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => currentNotifs });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('NotificationsPage — lista completa de notificações', () => {
  it('lista notificações lidas e não lidas', async () => {
    currentNotifs = [
      { id: 1, mensagem: '🎯 Meta atingida: Vendas', lida: false, created_at: '2026-07-08T00:00:00' },
      { id: 2, mensagem: 'Bem-vindo!', lida: true, created_at: '2026-07-01T00:00:00' },
    ];
    render(<NotificationsPage />);

    expect(await screen.findByText(/meta atingida: vendas/i)).toBeInTheDocument();
    expect(screen.getByText(/bem-vindo/i)).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há notificações', async () => {
    currentNotifs = [];
    render(<NotificationsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(await screen.findByText(/nenhuma notificação/i)).toBeInTheDocument();
  });

  it('marca uma notificação como lida ao clicar em "marcar como lida"', async () => {
    currentNotifs = [
      { id: 1, mensagem: 'Meta atingida', lida: false, created_at: '2026-07-08T00:00:00' },
    ];
    render(<NotificationsPage />);

    const botao = await screen.findByRole('button', { name: /marcar como lida/i });
    fireEvent.click(botao);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/1/read/'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
