import { nextRouteAfterLogin } from '@/lib/postLogin';

afterEach(() => { delete (global as { fetch?: unknown }).fetch; });

function mockMe(body: unknown, ok = true) {
  (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok, json: async () => body });
}

test('sem organização vai para o onboarding', async () => {
  mockMe({ organizations: [] });
  expect(await nextRouteAfterLogin('tok')).toBe('/onboarding');
});

test('com organização vai para o dashboard', async () => {
  mockMe({ organizations: [{ id: 1, nome: 'X', role: 'admin' }] });
  expect(await nextRouteAfterLogin('tok')).toBe('/dashboard');
});

test('erro no /me cai no dashboard (não trava o login)', async () => {
  mockMe(null, false);
  expect(await nextRouteAfterLogin('tok')).toBe('/dashboard');
});

test('falha de rede cai no dashboard', async () => {
  (global as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('net'));
  expect(await nextRouteAfterLogin('tok')).toBe('/dashboard');
});
