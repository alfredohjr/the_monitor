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
    expect(text).toMatch(/métricas|metas/i);
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
    expect(text).toMatch(/login|autenticação|protegid/i);
    expect(text).toContain('/dashboard');
  });
});
