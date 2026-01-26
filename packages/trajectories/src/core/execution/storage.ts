/**
 * AgentMemory initialization helper
 */

import { InMemoryAgentMemory } from '../memory/InMemoryAgentMemory.js';

/**
 * Initialize internal AgentMemory.
 *
 * AgentMemory is intentionally not configurable via the public trajectories API.
 * Durable persistence (if desired) is handled via core TallyStore.
 */
export function initializeAgentMemory(): InMemoryAgentMemory {
	return new InMemoryAgentMemory();
}
