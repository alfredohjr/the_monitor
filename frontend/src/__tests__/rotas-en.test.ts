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

test('sub-rotas de metas e lançamentos redirecionam (#312)', async () => {
  const rs = await redirects();
  const mapa = Object.fromEntries(rs.map((r) => [r.source, r.destination]));
  expect(mapa['/metas/importar']).toBe('/goals/import');
  expect(mapa['/metas/ancorar']).toBe('/goals/anchor');
  expect(mapa['/metas/clonar']).toBe('/goals/clone');
  expect(mapa['/lancamentos/importar']).toBe('/logs/import');
});

test('os destinos novos não colidem com as rotas dinâmicas [id]', async () => {
  // /goals/[id] e /logs/[id] já existem. No Next uma rota estática vence a
  // dinâmica, mas o destino precisa ser um segmento que NÃO é um id válido —
  // senão "import" seria interpretado como id por qualquer código que monte a
  // URL na mão.
  const rs = await redirects();
  const destinos = rs.map((r) => r.destination);
  for (const d of destinos) {
    const ultimo = d.split('/').pop() ?? '';
    expect(/^\d+$/.test(ultimo)).toBe(false);
  }
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
