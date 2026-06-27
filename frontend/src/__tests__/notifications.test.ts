import { unreadCount, fetchNotifications, markNotificationRead, Notification } from '@/lib/notifications';

function notif(id: number, lida: boolean): Notification {
  return { id, mensagem: `n${id}`, lida, created_at: '2026-06-26' };
}

describe('notifications lib (issue #30)', () => {
  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  it('unreadCount conta apenas as nao lidas', () => {
    expect(unreadCount([notif(1, false), notif(2, true), notif(3, false)])).toBe(2);
    expect(unreadCount([])).toBe(0);
  });

  it('fetchNotifications chama o endpoint com o token', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [notif(1, false)] } as Response);
    (global as { fetch: unknown }).fetch = fetchMock;

    const list = await fetchNotifications('tok', 'http://api');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/api/v1/notifications/',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
    expect(list).toHaveLength(1);
  });

  it('markNotificationRead faz POST no endpoint de leitura', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => notif(5, true) } as Response);
    (global as { fetch: unknown }).fetch = fetchMock;

    const updated = await markNotificationRead(5, 'tok', 'http://api');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/api/v1/notifications/5/read/',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer tok' } }),
    );
    expect(updated.lida).toBe(true);
  });
});
