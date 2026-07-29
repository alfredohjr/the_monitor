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
  fireEvent.change(screen.getByPlaceholderText(/you@email/i), { target: { value: 'Ana@X.com' } });
  fireEvent.click(screen.getByRole('button', { name: /send link/i }));

  await screen.findByText(/if the email is registered/i);
  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  expect(fetchMock.mock.calls[0][0]).toContain('/password-reset/request/');
  expect(body.email).toBe('ana@x.com'); // normalizado
});

// --- ResetPassword ---

test('ResetPassword redefine a senha e vai para o login', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ reset: true }) });
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ResetPassword />);
  fireEvent.change(screen.getByPlaceholderText('New password'), { target: { value: 'novaSenha1' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'novaSenha1' } });
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await screen.findByText(/password reset/i);
  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  expect(body).toEqual({ token: 'tok-123', password: 'novaSenha1' });
});

test('ResetPassword bloqueia senhas diferentes sem chamar a API', async () => {
  const fetchMock = jest.fn();
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ResetPassword />);
  fireEvent.change(screen.getByPlaceholderText('New password'), { target: { value: 'novaSenha1' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'outra12345' } });
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await screen.findByRole('alert');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('ResetPassword: olho mostra/oculta a senha', () => {
  render(<ResetPassword />);
  const senha = screen.getByPlaceholderText('New password') as HTMLInputElement;
  expect(senha.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: /show password/i }));
  expect(senha.type).toBe('text');
});

test('ResetPassword sem token mostra erro', async () => {
  tokenParam = null;
  const fetchMock = jest.fn();
  (global as { fetch: unknown }).fetch = fetchMock;
  render(<ResetPassword />);
  fireEvent.change(screen.getByPlaceholderText('New password'), { target: { value: 'novaSenha1' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'novaSenha1' } });
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
  await screen.findByRole('alert');
  expect(fetchMock).not.toHaveBeenCalled();
});

describe('Recuperação de senha — idioma (#284)', () => {
  it('ForgotPassword renderiza em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    render(<ForgotPassword />);
    expect(screen.getByText('Esqueci minha senha')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/seu@email/i)).toBeInTheDocument();
    localStorage.clear();
  });

  it('ResetPassword renderiza em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    render(<ResetPassword />);
    expect(screen.getByPlaceholderText('Nova senha')).toBeInTheDocument();
    localStorage.clear();
  });
});
