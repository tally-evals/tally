import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Talk: From Vibes to Verdicts | Tally',
  description: 'Engineering Reliable AI Agents with Tally - A presentation on multi-turn agent evaluation.',
};

export default function TalkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
