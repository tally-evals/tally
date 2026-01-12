/**
 * Type definitions for Tally CLI
 */

export type ViewMode = 'summary' | 'turn-by-turn';

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'conversation' | 'run';
  runs?: RunNode[];
}

export interface RunNode {
  runId: string;
  reportPath: string;
  conversationPath?: string;
  timestamp?: string;
}

export interface DirectoryTree {
  conversations: DirectoryNode[];
}

export interface BrowseState {
  selectedConversation: DirectoryNode | null;
  selectedRun: RunNode | null;
  navigationStack: ('conversations' | 'runs')[];
}
