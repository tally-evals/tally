import type { DatasetItem } from '../../src/index';

export const datasetExampleA: readonly DatasetItem[] = [
	{
		id: 'exA-1',
		prompt: 'What is the capital of France?',
		completion: 'Paris',
		metadata: { source: 'exampleA' },
	},
	{
		id: 'exA-2',
		prompt: '2 + 2 = ?',
		completion: '4',
		metadata: { source: 'exampleA' },
	},
] as const;

export const datasetExampleB: readonly DatasetItem[] = [
	{
		id: 'exB-1',
		prompt: 'Name a mammal that can fly.',
		completion: 'Bat',
		metadata: { source: 'exampleB' },
	},
	{
		id: 'exB-2',
		prompt: 'What color is the sky on a clear day?',
		completion: 'Blue',
		metadata: { source: 'exampleB' },
	},
] as const;


