import robots from '../app/robots';

describe('robots.txt', () => {
  it('permite crawlers em páginas públicas', () => {
    const { rules } = robots();
    const publicRule = Array.isArray(rules)
      ? rules.find((r: { userAgent: string }) => r.userAgent === '*')
      : rules;
    expect(publicRule).toBeDefined();
    const allowed: string[] = [].concat((publicRule as { allow?: string | string[] }).allow ?? []);
    expect(allowed).toContain('/');
  });

  it('bloqueia crawlers em páginas protegidas', () => {
    const { rules } = robots();
    const publicRule = Array.isArray(rules)
      ? rules.find((r: { userAgent: string }) => r.userAgent === '*')
      : rules;
    const disallowed: string[] = [].concat((publicRule as { disallow?: string | string[] }).disallow ?? []);
    expect(disallowed).toContain('/dashboard');
    expect(disallowed).toContain('/goals');
    expect(disallowed).toContain('/logs');
    expect(disallowed).toContain('/metrics');
    expect(disallowed).toContain('/simulacao');
  });
});
