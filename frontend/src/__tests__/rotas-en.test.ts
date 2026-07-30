/**
 * Rotas em inglês com redirect (#311).
 *
 * A rota antiga não pode virar 404: bookmark de usuário atual e link já
 * compartilhado continuam funcionando. 308 (permanente) e não 302, para o
 * navegador e os buscadores aprenderem o destino novo.
 */
import nextConfig from '../../next.config';

type Redirect = { source: string; destination: string; permanent: boolean };

async function redirects(): Promise<Redirect[]> {
  const fn = (nextConfig as { redirects?: () => Promise<Redirect[]> }).redirects;
  expect(typeof fn).toBe('function');
  return fn!.call(nextConfig);
}

test('as três rotas antigas redirecionam para as novas', async () => {
  const rs = await redirects();
  const mapa = Object.fromEntries(rs.map((r) => [r.source, r.destination]));
  expect(mapa['/perfil']).toBe('/profile');
  expect(mapa['/notificacoes']).toBe('/notifications');
  expect(mapa['/simulacao']).toBe('/simulation');
});

test('os redirects são permanentes (308)', async () => {
  const rs = await redirects();
  for (const r of rs) {
    expect(r.permanent).toBe(true);
  }
});

test('nenhuma rota nova redireciona de volta (sem laço)', async () => {
  const rs = await redirects();
  const fontes = new Set(rs.map((r) => r.source));
  for (const r of rs) {
    expect(fontes.has(r.destination)).toBe(false);
  }
});
