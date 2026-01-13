import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { Activity, Route, Box } from 'lucide-react';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout 
      tree={source.getPageTree()} 
      {...baseOptions()}
      sidebar={{
        tabs: [
          {
            title: 'Tally',
            description: 'Evaluation Framework',
            url: '/docs/tally',
            // Fumadocs only shows the tabs trigger when one tab is "active".
            // We explicitly list all sub-paths plus the /docs landing page to keep it visible.
            urls: new Set([
              '/docs',
              '/docs/tally',
              '/docs/tally/why-tally',
              '/docs/tally/getting-started',
              '/docs/tally/concepts',
              '/docs/tally/metrics',
              '/docs/tally/metrics/builtin',
              '/docs/tally/metrics/custom',
              '/docs/tally/scorers',
              '/docs/tally/evals',
              '/docs/tally/aggregators',
              '/docs/tally/reports',
            ]),
            icon: <Activity className="text-blue-500" />,
          },
          {
            title: 'Trajectories',
            description: 'Data Generation',
            url: '/docs/trajectories',
            urls: new Set([
              '/docs/trajectories',
              '/docs/trajectories/getting-started',
              '/docs/trajectories/agent-wrappers',
              '/docs/trajectories/personas',
              '/docs/trajectories/step-graphs',
              '/docs/trajectories/preconditions',
              '/docs/trajectories/output-formats',
              '/docs/trajectories/adversarial',
            ]),
            icon: <Route className="text-purple-500" />,
          },
          {
            title: 'Core',
            description: 'Common Infrastructure',
            url: '/docs/core',
            urls: new Set([
              '/docs/core',
              '/docs/core/configuration',
              '/docs/core/storage',
              '/docs/core/types',
            ]),
            icon: <Box className="text-orange-500" />,
          },
        ],
      }}
    >
      {children}
    </DocsLayout>
  );
}
