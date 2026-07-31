/**
 * Rótulos de tipo e período (#367).
 *
 * As duas telas que exibem esses campos mostravam o identificador cru da API
 * ("number", "daily"). O helper é compartilhado justamente para as duas não
 * divergirem — foi por isso que o #298 não traduziu só o catálogo.
 */
import { rotuloTipo, rotuloPeriodo } from '@/lib/metricLabels';

afterEach(() => localStorage.clear());

describe('rotuloTipo', () => {
  it('traduz os tipos conhecidos', () => {
    expect(rotuloTipo('number')).toBe('Whole Number');
    expect(rotuloTipo('currency')).toBe('Currency');
    expect(rotuloTipo('boolean')).toBe('Boolean');
  });

  it('acompanha o locale', () => {
    localStorage.setItem('locale', 'pt-BR');
    expect(rotuloTipo('number')).toBe('Número Inteiro');
    expect(rotuloTipo('currency')).toBe('Monetário');
  });

  it('tipo desconhecido cai no valor cru, não em vazio', () => {
    // Mesmo padrão do papel do usuário no #296: se o backend ganhar um tipo
    // novo, a tela mostra o identificador em vez de célula vazia.
    expect(rotuloTipo('quantum')).toBe('quantum');
    expect(rotuloTipo('')).toBe('');
  });
});

describe('rotuloPeriodo', () => {
  it('traduz os períodos conhecidos', () => {
    expect(rotuloPeriodo('daily')).toBe('Daily');
    expect(rotuloPeriodo('yearly')).toBe('Yearly');
  });

  it('acompanha o locale', () => {
    localStorage.setItem('locale', 'pt-BR');
    expect(rotuloPeriodo('daily')).toBe('Diário');
    expect(rotuloPeriodo('monthly')).toBe('Mensal');
  });

  it('período desconhecido cai no valor cru', () => {
    expect(rotuloPeriodo('hourly')).toBe('hourly');
  });
});

describe('as duas telas usam a MESMA fonte', () => {
  it('os rótulos vêm do catálogo de métricas, não de mapas locais', () => {
    // Se alguém criar um segundo mapa numa das telas, este teste continua
    // passando — mas a guarda real é o helper ser o único caminho. O #298
    // registrou o motivo: duas telas mostrando o mesmo dado de formas
    // diferentes é pior que as duas mostrando o identificador cru.
    const t = require('@/lib/i18n').t as (k: string) => string;
    expect(rotuloTipo('number')).toBe(t('metrics.typeNumber'));
    expect(rotuloPeriodo('daily')).toBe(t('metrics.freqDaily'));
  });
});
