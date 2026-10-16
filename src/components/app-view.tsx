import { Dashboard } from './dashboard';
import { Markets } from './markets';
import { ChartWorkspace } from './chart-workspace';
import { Analyst } from './analyst';
import { Portfolio } from './portfolio';
import { Watchlists } from './watchlists';
import { News } from './news';
import { Settings } from './settings';
export const sections = [
  'dashboard',
  'markets',
  'charts',
  'analyst',
  'portfolio',
  'watchlists',
  'news',
  'settings',
  'onboarding',
];
export function AppView({ section }: { section: string }) {
  switch (section) {
    case 'markets':
      return <Markets />;
    case 'charts':
      return <ChartWorkspace />;
    case 'analyst':
      return <Analyst />;
    case 'portfolio':
      return <Portfolio />;
    case 'watchlists':
      return <Watchlists />;
    case 'news':
      return <News />;
    case 'settings':
      return <Settings />;
    case 'onboarding':
      return <Settings onboarding />;
    default:
      return <Dashboard />;
  }
}
