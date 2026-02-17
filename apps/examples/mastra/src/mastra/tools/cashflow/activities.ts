import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getProfile, saveProfile, Activity } from './db';

// Simple deterministic ID generator
const generateId = () => `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Tool to set monthly activity goals
 * User specifies activities they want to do this month
 */
export const setMonthlyActivitiesTool = createTool({
  id: 'set-monthly-activities',
  description: 'Set the list of activities the user wants to do this month. Each activity includes name, cost, and desired frequency.',
  inputSchema: z.object({
    activities: z.array(z.object({
      name: z.string().describe('Activity name (e.g., "Yoga class")'),
      cost: z.number().describe('Cost per activity'),
      count: z.number().describe('Number of times they want to do this activity this month'),
    })),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    
    // Clear existing activities and create new planned activities
    const newActivities: Activity[] = [];
    
    for (const activityInput of context.activities) {
      // Create multiple instances based on count
      for (let i = 0; i < activityInput.count; i++) {
        newActivities.push({
          id: generateId(),
          name: activityInput.name,
          cost: activityInput.cost,
          duration: 0, // No longer used but kept for DB compatibility
          status: 'planned',
        });
      }
    }
    
    profile.activities = newActivities;
    saveProfile(profile);
    
    // Calculate totals
    const totalCost = newActivities.reduce((sum, act) => sum + act.cost, 0);
    
    // Group by activity name for summary
    const summary = context.activities.map(act => {
      return {
        name: act.name,
        count: act.count,
        totalCost: act.cost * act.count,
      };
    });
    
    return {
      success: true,
      totalActivities: newActivities.length,
      totalCost,
      summary,
      message: `Set ${newActivities.length} activities for the month`,
    };
  },
});

/**
 * Tool to suggest activities based on affordability
 * Checks which activities the user can afford
 */
export const suggestActivitiesTool = createTool({
  id: 'suggest-activities',
  description: 'Suggest activities from the planned list based on affordability.',
  inputSchema: z.object({}),
  execute: async () => {
    const profile = getProfile();
    
    // Get remaining (planned) activities
    const remainingActivities = profile.activities?.filter(act => act.status === 'planned') || [];
    
    if (remainingActivities.length === 0) {
      return {
        success: true,
        suggestions: [],
        remaining: [],
        message: 'No activities planned for this month',
      };
    }
    
    // Check affordability for each activity
    const suggestions = remainingActivities.map(act => {
      const afterPurchase = profile.currentBalance - act.cost;
      const affordable = afterPurchase >= profile.safetyBuffer;
      
      return {
        id: act.id,
        name: act.name,
        cost: act.cost,
        affordable,
        balanceAfter: afterPurchase,
      };
    });
    
    // Sort by: affordable first, then by cost (cheapest first)
    const sortedSuggestions = suggestions.sort((a, b) => {
      if (a.affordable !== b.affordable) return b.affordable ? 1 : -1;
      return a.cost - b.cost;
    });
    
    // Group remaining activities by name with counts
    const remainingByName = remainingActivities.reduce((acc, act) => {
      if (!acc[act.name]) {
        acc[act.name] = { count: 0, cost: act.cost };
      }
      acc[act.name]!.count++;
      return acc;
    }, {} as Record<string, { count: number; cost: number }>);
    
    const remainingSummary = Object.entries(remainingByName).map(([name, data]) => ({
      name,
      count: data.count,
      costPerActivity: data.cost,
      totalCost: data.cost * data.count,
    }));
    
    return {
      success: true,
      suggestions: sortedSuggestions,
      remaining: remainingSummary,
      totalRemaining: remainingActivities.length,
      currentBalance: profile.currentBalance,
      safetyBuffer: profile.safetyBuffer,
    };
  },
});

/**
 * Tool to mark an activity as completed
 */
export const markActivityCompletedTool = createTool({
  id: 'mark-activity-completed',
  description: 'Mark an activity as completed. This removes it from the planned list and updates the balance.',
  inputSchema: z.object({
    activityId: z.string().describe('ID of the activity to mark as completed'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    
    const activity = profile.activities?.find(act => act.id === context.activityId);
    
    if (!activity) {
      return {
        success: false,
        message: 'Activity not found',
      };
    }
    
    if (activity.status === 'completed') {
      return {
        success: false,
        message: 'Activity already completed',
      };
    }
    
    // Mark as completed
    activity.status = 'completed';
    activity.completedAt = new Date().toISOString();
    
    // Deduct cost from balance
    profile.currentBalance -= activity.cost;
    
    saveProfile(profile);
    
    // Calculate remaining activities
    const remaining = profile.activities?.filter(act => act.status === 'planned') || [];
    
    return {
      success: true,
      completed: {
        name: activity.name,
        cost: activity.cost,
      },
      newBalance: profile.currentBalance,
      remainingActivities: remaining.length,
      message: `Completed "${activity.name}". Balance updated to ${profile.currentBalance}.`,
    };
  },
});

/**
 * Tool to view all remaining activities for the month
 */
export const viewRemainingActivitiesTool = createTool({
  id: 'view-remaining-activities',
  description: 'View all remaining (planned) activities for the month with summary statistics.',
  inputSchema: z.object({}),
  execute: async () => {
    const profile = getProfile();
    
    const remaining = profile.activities?.filter(act => act.status === 'planned') || [];
    const completed = profile.activities?.filter(act => act.status === 'completed') || [];
    
    if (remaining.length === 0) {
      return {
        success: true,
        remaining: [],
        completed: completed.length,
        message: 'All activities completed for this month!',
      };
    }
    
    // Group by activity name
    const byName = remaining.reduce((acc, act) => {
      if (!acc[act.name]) {
        acc[act.name] = { count: 0, cost: act.cost };
      }
      acc[act.name]!.count++;
      return acc;
    }, {} as Record<string, { count: number; cost: number }>);
    
    const summary = Object.entries(byName).map(([name, data]) => ({
      name,
      count: data.count,
      costPerActivity: data.cost,
      totalCost: data.cost * data.count,
    }));
    
    const totalCost = remaining.reduce((sum, act) => sum + act.cost, 0);
    
    return {
      success: true,
      remaining: summary,
      totalRemaining: remaining.length,
      totalCost,
      completed: completed.length,
      currentBalance: profile.currentBalance,
      safetyBuffer: profile.safetyBuffer,
      affordableAll: profile.currentBalance - totalCost >= profile.safetyBuffer,
    };
  },
});

/**
 * Tool to clear all activities (useful for starting fresh next month)
 */
export const clearActivitiesTool = createTool({
  id: 'clear-activities',
  description: 'Clear all activities for the month. Use this to reset for a new month.',
  inputSchema: z.object({}),
  execute: async () => {
    const profile = getProfile();
    const previousCount = profile.activities?.length || 0;
    profile.activities = [];
    saveProfile(profile);
    
    return {
      success: true,
      message: `Cleared ${previousCount} activities. Ready for new month!`,
    };
  },
});

