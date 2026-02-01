import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { TallyLogoWithText } from '@/components/Logo';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <TallyLogoWithText size={28} />,
    },
    githubUrl: 'https://github.com/tally-evals/tally',
    themeSwitch: {
      enabled: true,
      mode: 'light-dark-system',
    },
  };
}
