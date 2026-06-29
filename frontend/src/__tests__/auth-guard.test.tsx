/**
 * Garante que toda página protegida redireciona para /login quando não há token.
 * Regra: qualquer nova página autenticada DEVE ter este comportamento testado aqui.
 */
import { render } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import GoalList from '@/components/goals/GoalList';
import GoalForm from '@/components/goals/GoalForm';
import LogList from '@/components/logs/LogList';
import LogForm from '@/components/logs/LogForm';
import MetricList from '@/components/metrics/MetricList';
import MetricForm from '@/components/metrics/MetricForm';
import SimulationDashboard from '@/components/simulation/SimulationDashboard';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
  useParams: () => ({ id: '1' }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => {
  localStorage.clear();
  mockPush.mockClear();
  (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);
});

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

function expectRedirectToLogin(component: React.ReactElement) {
  render(component);
  expect(mockPush).toHaveBeenCalledWith('/login');
}

describe('Auth guard — redireciona para /login sem token', () => {
  it('DashboardGrid', () => expectRedirectToLogin(<DashboardGrid />));
  it('GoalList', () => expectRedirectToLogin(<GoalList />));
  it('GoalForm (nova meta)', () => expectRedirectToLogin(<GoalForm />));
  it('LogList', () => expectRedirectToLogin(<LogList />));
  it('LogForm (novo lançamento)', () => expectRedirectToLogin(<LogForm />));
  it('MetricList', () => expectRedirectToLogin(<MetricList />));
  it('MetricForm (nova métrica)', () => expectRedirectToLogin(<MetricForm />));
  it('SimulationDashboard', () => expectRedirectToLogin(<SimulationDashboard />));
  it('OnboardingFlow', () => expectRedirectToLogin(<OnboardingFlow />));
});

describe('Auth guard — nao redireciona com token', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'fake-token');
  });

  it('DashboardGrid', () => { render(<DashboardGrid />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('GoalList', () => { render(<GoalList />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('GoalForm', () => { render(<GoalForm />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('LogList', () => { render(<LogList />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('LogForm', () => { render(<LogForm />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('MetricList', () => { render(<MetricList />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('MetricForm', () => { render(<MetricForm />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('SimulationDashboard', () => { render(<SimulationDashboard />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('OnboardingFlow', () => { render(<OnboardingFlow />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
});
