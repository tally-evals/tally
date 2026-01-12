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
      tabMode="top"
      sidebar={{
        tabs: [
          {
            title: 'Tally',
            description: 'Evaluation Framework',
            url: '/docs/tally',
            icon: <Activity className="text-blue-500" />,
          },
          {
            title: 'Trajectories',
            description: 'Data Generation',
            url: '/docs/trajectories',
            icon: <Route className="text-purple-500" />,
          },
          {
            title: 'Core',
            description: 'Common Infrastructure',
            url: '/docs/core',
            icon: <Box className="text-orange-500" />,
          },
        ],
      }}
    >
      {children}
    </DocsLayout>
  );
}
