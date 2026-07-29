import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/onboarding',
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('access_token', 'tok');
  mockPush.mockClear();
});

afterEach(() => { delete (global as { fetch?: unknown }).fetch; });

test('usuário sem org vê o passo de criar organização', async () => {
  (global as { fetch: unknown }).fetch = jest.fn((url: string) => {
    if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => ({ organizations: [], display_name: '' }) });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  render(<OnboardingFlow />);
  await screen.findByLabelText(/organization name/i);
});

test('cria a org via POST /onboarding e avança para métricas', async () => {
  const onboard = jest.fn();
  (global as { fetch: unknown }).fetch = jest.fn((url: string, opts?: RequestInit) => {
    if (url.includes('/api/v1/onboarding/')) {
      onboard(JSON.parse(opts!.body as string));
      return Promise.resolve({ ok: true, json: async () => ({ id: 7, nome: 'Minha Loja', role: 'admin', display_name: 'Alfredo' }) });
    }
    if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => ({ organizations: [], display_name: '' }) });
    // /metrics/
    return Promise.resolve({ ok: true, json: async () => [{ id: 1, nome: 'Vendas', descricao: 'x', is_default: true }] });
  });

  render(<OnboardingFlow />);
  fireEvent.change(await screen.findByLabelText(/your name/i), { target: { value: 'Alfredo' } });
  fireEvent.change(screen.getByLabelText(/organization name/i), { target: { value: 'Minha Loja' } });
  fireEvent.click(screen.getByRole('button', { name: /create organization/i }));

  await waitFor(() => expect(onboard).toHaveBeenCalledWith({ organizacao: 'Minha Loja', display_name: 'Alfredo' }));
  // avança para o passo de métricas
  await screen.findByText(/first steps/i);
  expect(localStorage.getItem('active_org_id')).toBe('7');
});

test('org vazia mostra erro e não chama a API', async () => {
  const onboard = jest.fn();
  (global as { fetch: unknown }).fetch = jest.fn((url: string) => {
    if (url.includes('/api/v1/onboarding/')) { onboard(); return Promise.resolve({ ok: true, json: async () => ({}) }); }
    if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => ({ organizations: [] }) });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  render(<OnboardingFlow />);
  fireEvent.click(await screen.findByRole('button', { name: /create organization/i }));
  await screen.findByRole('alert');
  expect(onboard).not.toHaveBeenCalled();
});

test('usuário com org pula direto para o passo de métricas', async () => {
  (global as { fetch: unknown }).fetch = jest.fn((url: string) => {
    if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => ({ organizations: [{ id: 1, nome: 'X', role: 'admin' }] }) });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  render(<OnboardingFlow />);
  await screen.findByText(/first steps/i);
  expect(screen.queryByLabelText(/organization name/i)).toBeNull();
});

test('renderiza o passo da organização em pt-BR quando o locale está salvo', async () => {
  localStorage.setItem('locale', 'pt-BR');
  (global as { fetch: unknown }).fetch = jest.fn((url: string) => {
    if (url.includes('/me/')) return Promise.resolve({ ok: true, json: async () => ({ organizations: [], display_name: '' }) });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  render(<OnboardingFlow />);
  expect(await screen.findByLabelText(/nome da organização/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /criar organização/i })).toBeInTheDocument();
});
