import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createUser, getUserById } from './db/repository';

const generateId = () => `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const createUserTool = createTool({
    id: 'create-user',
    description: 'Create a new user. Returns the created user with a generated id.',
    inputSchema: z.object({
        name: z.string().describe('The name of the user'),
        baseCurrency: z.string().default('USD').describe('Base currency code, e.g. USD, PKR'),
    }),
    execute: async ({ context }) => {
        const id = generateId();
        const user = await createUser({ id, name: context.name, baseCurrency: context.baseCurrency });
        return { success: true, user };
    },
});

export const getUserTool = createTool({
    id: 'get-user',
    description: 'Retrieve an existing user by id.',
    inputSchema: z.object({
        userId: z.string().describe('The user id to look up'),
    }),
    execute: async ({ context }) => {
        const user = await getUserById(context.userId);
        if (!user) return { success: false, message: `No user found with id ${context.userId}` };
        return { success: true, user };
    },
});
