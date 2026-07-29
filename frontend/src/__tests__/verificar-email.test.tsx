import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VerifyEmail from '@/components/auth/VerifyEmail';
import RegisterPage from '../app/register/page';

let searchToken: string | null = 'tok-abc';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (k: string) => (k === 'token' ? searchToken : null) }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
  mockPush.mockClear();
  searchToken = 'tok-abc';
});

describe('VerifyEmail', () => {
  it('mostra sucesso quando o token é válido', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ verified: true }) });
    render(<VerifyEmail />);
    await waitFor(() => expect(screen.getByText(/email verified/i)).toBeInTheDocument());
    expect(screen.getByText(/go to sign-in/i)).toBeInTheDocument();
  });

  it('mostra erro quando o token é inválido', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Token expirado' }) });
    render(<VerifyEmail />);
    await waitFor(() => expect(screen.getByText(/token expirado/i)).toBeInTheDocument());
  });

  it('não chama a API sem token', async () => {
    searchToken = null;
    const fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
    render(<VerifyEmail />);
    await waitFor(() => expect(screen.getByText(/missing token/i)).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Register — confirmação por e-mail', () => {
  it('mostra aviso de verificação em vez de logar quando há e-mail', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const { container } = render(<RegisterPage />);
    fireEvent.change(container.querySelector('input[name="username"]')!, { target: { value: 'ana' } });
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'ana@x.com' } });
    fireEvent.change(container.querySelector('input[name="organizacao"]')!, { target: { value: 'Acme' } });
    fireEvent.change(container.querySelector('input[name="codigo"]')!, { target: { value: 'chave-acme' } });
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'senha123' } });
    fireEvent.change(container.querySelector('input[name="confirm"]')!, { target: { value: 'senha123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => expect(screen.getByText(/confirmation link/i)).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalledWith('/onboarding');
  });
});

describe('VerifyEmail — idioma (#284)', () => {
  it('renderiza o título em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    // Sem token o componente nem chega a chamar a API — o que interessa aqui
    // é só o idioma do título.
    searchToken = null;
    render(<VerifyEmail />);
    expect(screen.getByText('Confirmação de e-mail')).toBeInTheDocument();
    localStorage.clear();
  });
});
