import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPassword from '@/components/auth/ForgotPassword';
import ResetPassword from '@/components/auth/ResetPassword';

const mockPush = jest.fn();
let tokenParam: string | null = 'tok-123';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (k: string) => (k === 'token' ? tokenParam : null) }),
}));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (<a href={href}>{children}</a>);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => { mockPush.mockClear(); tokenParam = 'tok-123'; });
afterEach(() => { delete (global as { fetch?: unknown }).fetch; });

// --- ForgotPassword ---

test('ForgotPassword envia o e-mail e mostra confirmação genérica', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ForgotPassword />);
  fireEvent.change(screen.getByPlaceholderText(/seu@email/i), { target: { value: 'Ana@X.com' } });
  fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

  await screen.findByText(/se o e-mail estiver cadastrado/i);
  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  expect(fetchMock.mock.calls[0][0]).toContain('/password-reset/request/');
  expect(body.email).toBe('ana@x.com'); // normalizado
});

// --- ResetPassword ---

test('ResetPassword redefine a senha e vai para o login', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ reset: true }) });
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ResetPassword />);
  fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'novaSenha1' } });
  fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), { target: { value: 'novaSenha1' } });
  fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

  await screen.findByText(/senha redefinida/i);
  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  expect(body).toEqual({ token: 'tok-123', password: 'novaSenha1' });
});

test('ResetPassword bloqueia senhas diferentes sem chamar a API', async () => {
  const fetchMock = jest.fn();
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ResetPassword />);
  fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'novaSenha1' } });
  fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), { target: { value: 'outra12345' } });
  fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

  await screen.findByRole('alert');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('ResetPassword: olho mostra/oculta a senha', () => {
  render(<ResetPassword />);
  const senha = screen.getByPlaceholderText('Nova senha') as HTMLInputElement;
  expect(senha.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: /mostrar senha/i }));
  expect(senha.type).toBe('text');
});

test('ResetPassword sem token mostra erro', async () => {
  tokenParam = null;
  const fetchMock = jest.fn();
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ResetPassword />);
  fireEvent.change(screen.getByPlaceholderText('Nova senha'), { target: { value: 'novaSenha1' } });
  fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), { target: { value: 'novaSenha1' } });
  fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));
  await screen.findByRole('alert');
  expect(fetchMock).not.toHaveBeenCalled();
});
