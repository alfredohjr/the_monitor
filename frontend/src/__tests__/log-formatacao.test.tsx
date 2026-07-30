import { render, screen } from '@testing-library/react';
import LogList from '@/components/logs/LogList';
import LogForm from '@/components/logs/LogForm';
import { formatValor, placeholderValor, setMoedaAtiva, simboloMoeda } from '@/lib/formatValor';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

// --- formatValor (pura) ---

describe('formatValor', () => {
  it('formata currency com R$', () => {
    expect(formatValor('500', 'currency')).toMatch(/R\$.*500/);
  });

  it('formata percent com %', () => {
    expect(formatValor('75', 'percent')).toBe('75%');
  });

  it('retorna valor sem alteração para number', () => {
    expect(formatValor('42', 'number')).toBe('42');
  });

  it('retorna valor sem alteração para string', () => {
    expect(formatValor('ok', 'string')).toBe('ok');
  });

  it('retorna string vazia sem alteração', () => {
    expect(formatValor('', 'currency')).toBe('');
  });
});

describe('placeholderValor', () => {
  it('retorna placeholder para currency', () => {
    expect(placeholderValor('currency')).toMatch(/R\$|500/);
  });

  it('retorna placeholder para percent', () => {
    expect(placeholderValor('percent')).toMatch(/%|75/);
  });

  it('retorna placeholder genérico para outros tipos', () => {
    expect(placeholderValor('number')).toBeTruthy();
  });
});

// --- LogList integração ---

describe('LogList — formatação por tipo', () => {
  function mockFetch(tipo: string, valor: string) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/logs/'))    return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 1, goal: 10, data: '2026-06-28', valor_logado: valor }] });
      if (url.includes('/goals/'))   return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 10, metric: 20, periodo_referencia: '' }] });
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 20, codigo: 'M', nome: 'Métrica', tipo }] });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe valor com R$ para tipo currency', async () => {
    mockFetch('currency', '500');
    render(<LogList />);
    expect(await screen.findByText(/R\$.*500|500.*R\$/)).toBeInTheDocument();
  });

  it('exibe valor com % para tipo percent', async () => {
    mockFetch('percent', '75');
    render(<LogList />);
    expect(await screen.findByText('75%')).toBeInTheDocument();
  });

  it('exibe valor sem formatação para tipo number', async () => {
    mockFetch('number', '42');
    render(<LogList />);
    expect(await screen.findByText('42')).toBeInTheDocument();
  });
});

// --- LogForm integração ---

describe('LogForm — placeholder por tipo', () => {
  it('mostra placeholder padrão sem meta selecionada', () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<LogForm />);
    const input = screen.getByPlaceholderText(/e\.g\.|ex:/i);
    expect(input).toBeInTheDocument();
  });
});

describe('LogForm — select de meta sem valor alvo', () => {
  it('não exibe o alvo nas opções do select', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/goals/'))   return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 10, metric: 20, alvo: '150', periodo_referencia: '2026-07' }] });
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 20, codigo: 'M', nome: 'Vendas', tipo: 'number' }] });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    render(<LogForm />);
    const option = await screen.findByRole('option', { name: /Vendas/ });
    expect(option).toBeInTheDocument();
    expect(option.textContent).not.toMatch(/Alvo/i);
    expect(option.textContent).not.toContain('150');
  });
});

describe('Lançamentos — idioma (#292)', () => {
  it('LogList renderiza em pt-BR quando o locale está salvo', async () => {
    localStorage.setItem('locale', 'pt-BR');
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<LogList />);
    expect(await screen.findByText('Histórico de Lançamentos')).toBeInTheDocument();
    expect(screen.getByText('Nenhum check-in submetido ainda.')).toBeInTheDocument();
  });

  it('LogForm renderiza em pt-BR quando o locale está salvo', async () => {
    localStorage.setItem('locale', 'pt-BR');
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<LogForm />);
    expect(await screen.findByText('Fazer Check-in')).toBeInTheDocument();
    expect(screen.getByText('Quanto atingiu?')).toBeInTheDocument();
  });
});

describe('formatValor — moeda da org + locale (#309)', () => {
  afterEach(() => localStorage.clear());

  it('usa BRL com formatação em inglês por padrão', () => {
    expect(formatValor('1234.5', 'currency')).toBe('R$ 1,234.50');
  });

  it('usa BRL com formatação em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    expect(formatValor('1234.5', 'currency')).toBe('R$ 1.234,50');
  });

  it('acompanha a moeda da organização ativa', () => {
    setMoedaAtiva('USD');
    expect(formatValor('1234.5', 'currency')).toBe('$ 1,234.50');
    setMoedaAtiva('EUR');
    expect(formatValor('1234.5', 'currency')).toBe('€ 1,234.50');
  });

  it('NÃO converte o valor — só muda a formatação', () => {
    // Trocar o símbolo convertendo daria outro número; trocar sem converter
    // mostra o mesmo dinheiro com outro rótulo. A segunda é a correta aqui:
    // não há taxa de câmbio no sistema, e inventar uma seria mentir sobre o dado.
    setMoedaAtiva('BRL');
    const emBRL = formatValor('100', 'currency');
    setMoedaAtiva('USD');
    const emUSD = formatValor('100', 'currency');
    expect(emBRL.replace(/[^\d.,]/g, '')).toBe(emUSD.replace(/[^\d.,]/g, ''));
  });

  it('moeda desconhecida cai em BRL em vez de estourar', () => {
    // Intl.NumberFormat lança RangeError com código inválido, e o erro
    // apareceria na tela de quem usa. O backend valida (#308), mas o front
    // não pode depender só disso.
    setMoedaAtiva('XYZ');
    expect(() => formatValor('10', 'currency')).not.toThrow();
    expect(formatValor('10', 'currency')).toContain('R$');
  });

  it('percent e number seguem intocados', () => {
    setMoedaAtiva('USD');
    expect(formatValor('75', 'percent')).toBe('75%');
    expect(formatValor('42', 'number')).toBe('42');
  });
});

describe('simboloMoeda (#309)', () => {
  afterEach(() => localStorage.clear());

  it('devolve o símbolo da moeda ativa', () => {
    setMoedaAtiva('BRL');
    expect(simboloMoeda()).toBe('R$');
    setMoedaAtiva('USD');
    expect(simboloMoeda()).toBe('$');
    setMoedaAtiva('EUR');
    expect(simboloMoeda()).toBe('€');
  });
});
