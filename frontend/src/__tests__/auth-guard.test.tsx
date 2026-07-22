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
import CatalogPage from '@/components/catalog/CatalogPage';
import AdminUsers from '@/components/admin/AdminUsers';
import ImportGoals from '@/components/goals/ImportGoals';
import ClonarMetas from '@/components/goals/ClonarMetas';
import ImportAnchored from '@/components/goals/ImportAnchored';
import ImportLogsCSV from '@/components/logs/ImportLogsCSV';
import ProfilePage from '@/components/profile/ProfilePage';
import NotificationsPage from '@/components/notifications/NotificationsPage';

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
  it('CatalogPage', () => expectRedirectToLogin(<CatalogPage />));
  it('AdminUsers', () => expectRedirectToLogin(<AdminUsers />));
  it('ImportGoals', () => expectRedirectToLogin(<ImportGoals />));
  it('ClonarMetas', () => expectRedirectToLogin(<ClonarMetas />));
  it('ImportAnchored', () => expectRedirectToLogin(<ImportAnchored />));
  it('ImportLogsCSV', () => expectRedirectToLogin(<ImportLogsCSV />));
  it('ProfilePage', () => expectRedirectToLogin(<ProfilePage />));
  it('NotificationsPage', () => expectRedirectToLogin(<NotificationsPage />));
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
  it('CatalogPage', () => { render(<CatalogPage />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('AdminUsers', () => { render(<AdminUsers />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('ImportGoals', () => { render(<ImportGoals />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('ClonarMetas', () => { render(<ClonarMetas />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('ImportAnchored', () => { render(<ImportAnchored />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('ImportLogsCSV', () => { render(<ImportLogsCSV />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('ProfilePage', () => { render(<ProfilePage />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
  it('NotificationsPage', () => { render(<NotificationsPage />); expect(mockPush).not.toHaveBeenCalledWith('/login'); });
});
