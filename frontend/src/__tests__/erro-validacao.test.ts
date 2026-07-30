/**
 * O 422 do pydantic (EmailStr) manda `detail` como LISTA de objetos, não string.
 * O código antigo fazia `new Error(data.detail)` / `setError(d.detail)`, o que
 * renderizava "[object Object]" no cadastro e quebrava o React no /admin
 * ("Objects are not valid as a React child"). `mensagemDeErro` normaliza isso.
 */
import { mensagemDeErro } from '@/lib/api';

describe('mensagemDeErro', () => {
  it('devolve a string quando o detail já é string (400/403)', () => {
    expect(mensagemDeErro('Email já cadastrado')).toBe('Email já cadastrado');
  });

  it('traduz o 422 de e-mail inválido do pydantic', () => {
    const detail = [
      {
        type: 'value_error',
        loc: ['body', 'email'],
        msg: 'value is not a valid email address: An email address must have an @-sign.',
        input: 'nao-e-email',
      },
    ];
    expect(mensagemDeErro(detail)).toBe('Invalid e-mail.');
  });

  it('nunca devolve [object Object] para detail em lista', () => {
    const detail = [{ type: 'missing', loc: ['body', 'username'], msg: 'Field required' }];
    expect(mensagemDeErro(detail)).not.toContain('[object Object]');
    expect(typeof mensagemDeErro(detail)).toBe('string');
  });

  it('usa mensagem genérica para 422 de outro campo', () => {
    const detail = [{ type: 'missing', loc: ['body', 'username'], msg: 'Field required' }];
    expect(mensagemDeErro(detail)).toBe('Check the form data.');
  });

  it('cai no fallback quando não há detail', () => {
    expect(mensagemDeErro(undefined, 'Erro ao criar conta')).toBe('Erro ao criar conta');
    expect(mensagemDeErro(null, 'Erro ao criar conta')).toBe('Erro ao criar conta');
  });

  it('não explode com detail em formato inesperado', () => {
    expect(typeof mensagemDeErro({ algo: 'estranho' })).toBe('string');
    expect(typeof mensagemDeErro([])).toBe('string');
  });
});

describe('mensagemDeErro — idioma (#303)', () => {
  afterEach(() => localStorage.clear());

  it('usa o catálogo no fallback e nas mensagens do 422', () => {
    const detail422 = [{ type: 'value_error', loc: ['body', 'email'], msg: 'x', input: 'y' }];
    expect(mensagemDeErro(undefined)).toBe('Unexpected error');
    expect(mensagemDeErro(detail422)).toBe('Invalid e-mail.');
    expect(mensagemDeErro([{ loc: ['body', 'nome'], msg: 'x' }])).toBe('Check the form data.');
  });

  it('acompanha o locale salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    const detail422 = [{ type: 'value_error', loc: ['body', 'email'], msg: 'x', input: 'y' }];
    expect(mensagemDeErro(undefined)).toBe('Erro inesperado');
    expect(mensagemDeErro(detail422)).toBe('E-mail inválido.');
  });

  it('o fallback é resolvido A CADA CHAMADA, não no carregamento do módulo', () => {
    // Se a tradução fosse feita no valor default do parâmetro, ela congelaria
    // no idioma vigente quando o módulo foi importado — e trocar de idioma não
    // teria efeito nenhum sobre os erros.
    expect(mensagemDeErro(undefined)).toBe('Unexpected error');
    localStorage.setItem('locale', 'pt-BR');
    expect(mensagemDeErro(undefined)).toBe('Erro inesperado');
  });

  it('fallback explícito do chamador continua vencendo', () => {
    expect(mensagemDeErro(undefined, 'Falha ao criar conta')).toBe('Falha ao criar conta');
  });
});
