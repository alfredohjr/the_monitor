/**
 * A versão do front deve refletir o que foi buildado (#146): lê
 * NEXT_PUBLIC_APP_VERSION (injetado como build-arg no CI) e cai num default
 * de dev quando ausente. Não pode ficar hardcoded.
 */
describe('APP_VERSION (frontend)', () => {
  const orig = process.env.NEXT_PUBLIC_APP_VERSION;
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_VERSION = orig;
    jest.resetModules();
  });

  it('usa NEXT_PUBLIC_APP_VERSION quando definido', () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_APP_VERSION = '0.4.2';
    const { APP_VERSION } = require('@/lib/version');
    expect(APP_VERSION).toBe('0.4.2');
  });

  it('cai no default da linha quando ausente', () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const { APP_VERSION } = require('@/lib/version');
    expect(APP_VERSION).toBe('0.4.0');
  });
});
