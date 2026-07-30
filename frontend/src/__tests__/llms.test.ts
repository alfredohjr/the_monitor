/**
 * @jest-environment node
 */
import { GET } from '../app/llms.txt/route';

describe('llms.txt', () => {
  it('retorna status 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('retorna content-type text/plain', async () => {
    const res = await GET();
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
  });

  it('contém o nome do projeto', async () => {
    const res = await GET();
    const text = await res.text();
    expect(text).toMatch(/The Monitor/i);
  });

  it('contém descrição do que é o sistema', async () => {
    const res = await GET();
    const text = await res.text();
    // O padrão é inglês (#314); o matcher cobre os dois para verificar que a
    // descrição EXISTE, não o idioma dela — isso tem teste próprio.
    expect(text).toMatch(/métricas|metas|metrics|goals/i);
  });

  it('lista as páginas públicas', async () => {
    const res = await GET();
    const text = await res.text();
    expect(text).toContain('/login');
    expect(text).toContain('/register');
  });

  it('indica que páginas protegidas requerem login', async () => {
    const res = await GET();
    const text = await res.text();
    expect(text).toMatch(/login|autenticação|protegid|authentication/i);
    expect(text).toContain('/dashboard');
  });
});

describe('llms.txt — idioma (#314)', () => {
  it('responde em inglês por padrão', async () => {
    const res = await GET(new Request('http://localhost/llms.txt'));
    const text = await res.text();
    expect(text).toMatch(/metrics and personal goals/i);
    expect(text).toContain('Home page');
  });

  it('responde em português quando o Accept-Language pede', async () => {
    const res = await GET(
      new Request('http://localhost/llms.txt', { headers: { 'Accept-Language': 'pt-BR' } }),
    );
    const text = await res.text();
    expect(text).toMatch(/métricas e metas pessoais/i);
    expect(text).toContain('Página inicial');
  });

  it('respeita o peso q do Accept-Language, não a ordem', async () => {
    // Mesma regra do backend (#299): "en;q=0.5,pt-BR;q=0.9" pede português.
    const res = await GET(
      new Request('http://localhost/llms.txt', {
        headers: { 'Accept-Language': 'en;q=0.5,pt-BR;q=0.9' },
      }),
    );
    expect(await res.text()).toContain('Página inicial');
  });

  it('as rotas listadas são as mesmas nos dois idiomas', async () => {
    // O conteúdo é traduzido, mas as ROTAS são identificadores — se divergirem,
    // um dos dois arquivos passa a documentar URLs que não existem.
    const rotas = (t: string) => (t.match(/`\/[a-z-]*`/g) ?? []).sort();
    const en = await (await GET(new Request('http://localhost/llms.txt'))).text();
    const pt = await (
      await GET(new Request('http://localhost/llms.txt', { headers: { 'Accept-Language': 'pt-BR' } }))
    ).text();
    expect(rotas(pt)).toEqual(rotas(en));
  });
});
