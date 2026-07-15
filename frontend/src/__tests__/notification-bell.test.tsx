import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import NotificationBell from '@/components/layout/NotificationBell';

let currentNotifs: object[] = [];

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  currentNotifs = [];
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/notifications/')) return Promise.resolve({ ok: true, status: 200, json: async () => currentNotifs });
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('NotificationBell — legibilidade (#182)', () => {
  it('o painel aberto tem fundo sólido (não translúcido)', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /notificações/i }));
    const panel = await screen.findByTestId('notif-panel');
    expect(panel.className).toContain('bg-zinc-900');
    expect(panel.className).not.toContain('glass');
  });
});

describe('NotificationBell — recarrega ao abrir', () => {
  it('busca notificações novas ao abrir o sino (não fica preso ao fetch inicial)', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Uma notificação nova chega no backend depois da carga inicial.
    currentNotifs = [{ id: 1, mensagem: '🎯 Meta atingida: Vendas', lida: false, created_at: '2026-07-08T00:00:00' }];

    fireEvent.click(screen.getByRole('button', { name: /notificações/i }));

    await waitFor(() => expect(screen.getByText(/meta atingida/i)).toBeInTheDocument());
  });
});

describe('NotificationBell — polling a cada 60s', () => {
  const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

  it('mostra o badge de não-lidas sozinho (sem abrir nem recarregar)', async () => {
    jest.useFakeTimers();
    try {
      render(<NotificationBell />);
      await flush(); // carga inicial (vazia) + token definido

      // Notificação nova chega no backend (ex.: meta atingida em outra tela).
      currentNotifs = [{ id: 1, mensagem: '🎯 Meta atingida', lida: false, created_at: '2026-07-08T00:00:00' }];

      // Sem abrir o sino nem recarregar: após 60s o polling atualiza sozinho.
      await act(async () => { jest.advanceTimersByTime(60000); });
      await flush();

      expect(screen.getByText('1')).toBeInTheDocument(); // badge de não-lidas
    } finally {
      jest.useRealTimers();
    }
  });
});
