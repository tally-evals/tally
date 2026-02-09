import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getProfile, saveProfile, Activity } from './db';

// Simple deterministic ID generator
const generateId = () => `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Convert hours and minutes to total minutes
 */
const convertToMinutes = (hours?: number, minutes?: number, totalMinutes?: number): number => {
  if (totalMinutes !== undefined) return totalMinutes;
  return (hours || 0) * 60 + (minutes || 0);
};

/**
 * Convert minutes to human-readable format
 */
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

/**
 * Tool to set monthly activity goals
 * User specifies activities they want to do this month
 */
export const setMonthlyActivitiesTool = createTool({
  id: 'set-monthly-activities',
  description: 'Set the list of activities the user wants to do this month. Each activity includes name, cost, duration (in hours/minutes), and desired frequency.',
  inputSchema: z.object({
    activities: z.array(z.object({
      name: z.string().describe('Activity name (e.g., "Yoga class")'),
      cost: z.number().describe('Cost per activity'),
      durationHours: z.number().optional().describe('Duration in hours (e.g., 1.5 for 1 hour 30 minutes)'),
      durationMinutes: z.number().optional().describe('Duration in minutes (e.g., 90)'),
      count: z.number().describe('Number of times they want to do this activity this month'),
    })),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    
    // Clear existing activities and create new planned activities
    const newActivities: Activity[] = [];
    
    for (const activityInput of context.activities) {
      // Convert duration to minutes
      const durationInMinutes = convertToMinutes(
        activityInput.durationHours,
        activityInput.durationMinutes
      );
      
      if (durationInMinutes <= 0) {
        throw new Error(`Invalid duration for activity "${activityInput.name}". Please provide duration in hours or minutes.`);
      }
      
      // Create multiple instances based on count
      for (let i = 0; i < activityInput.count; i++) {
        newActivities.push({
          id: generateId(),
          name: activityInput.name,
          cost: activityInput.cost,
          duration: durationInMinutes,
          status: 'planned',
        });
      }
    }
    
    profile.activities = newActivities;
    saveProfile(profile);
    
    // Calculate totals
    const totalCost = newActivities.reduce((sum, act) => sum + act.cost, 0);
    const totalDuration = newActivities.reduce((sum, act) => sum + act.duration, 0);
    
    // Group by activity name for summary
    const summary = context.activities.map(act => {
      const durationInMinutes = convertToMinutes(act.durationHours, act.durationMinutes);
      return {
        name: act.name,
        count: act.count,
        totalCost: act.cost * act.count,
        totalDuration: durationInMinutes * act.count,
        durationPerActivity: formatDuration(durationInMinutes),
      };
    });
    
    return {
      success: true,
      totalActivities: newActivities.length,
      totalCost,
      totalDuration: formatDuration(totalDuration),
      summary,
      message: `Set ${newActivities.length} activities for the month`,
    };
  },
});

/**
 * Tool to suggest activities based on available time
 * Filters activities by time available and checks affordability
 */
export const suggestActivitiesForTimeTool = createTool({
  id: 'suggest-activities-for-time',
  description: 'Suggest activities that fit within the available time the user has today, considering both time constraints and affordability.',
  inputSchema: z.object({
    availableHours: z.number().optional().describe('Available time in hours (e.g., 2 for 2 hours)'),
    availableMinutes: z.number().optional().describe('Available time in minutes (e.g., 120)'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    
    // Convert available time to minutes
    const availableMinutes = convertToMinutes(context.availableHours, context.availableMinutes);
    
    if (availableMinutes <= 0) {
      throw new Error('Please provide available time in hours or minutes.');
    }
    
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
    
    // Filter activities that fit in available time
    const timeFitActivities = remainingActivities.filter(act => act.duration <= availableMinutes);
    
    if (timeFitActivities.length === 0) {
      const shortestDuration = Math.min(...remainingActivities.map(a => a.duration));
      return {
        success: true,
        suggestions: [],
        remaining: remainingActivities.map(act => ({
          id: act.id,
          name: act.name,
          cost: act.cost,
          duration: formatDuration(act.duration),
        })),
        message: `No activities fit in ${formatDuration(availableMinutes)}. Your shortest activity is ${formatDuration(shortestDuration)}.`,
      };
    }
    
    // Check affordability for each time-fit activity
    const suggestions = timeFitActivities.map(act => {
      const afterPurchase = profile.currentBalance - act.cost;
      const affordable = afterPurchase >= profile.safetyBuffer;
      
      return {
        id: act.id,
        name: act.name,
        cost: act.cost,
        duration: formatDuration(act.duration),
        affordable,
        balanceAfter: afterPurchase,
        timeRemaining: formatDuration(availableMinutes - act.duration),
      };
    });
    
    // Sort by: affordable first, then by duration (shortest first)
    const sortedSuggestions = suggestions.sort((a, b) => {
      if (a.affordable !== b.affordable) return b.affordable ? 1 : -1;
      // For sorting, parse duration back to minutes
      const getDuration = (formattedDuration: string) => {
        const match = formattedDuration.match(/(\d+)\s*hr(?:\s*(\d+)\s*min)?|(\d+)\s*min/);
        if (!match) return 0;
        const hours = match[1] ? parseInt(match[1]) : 0;
        const mins = match[2] ? parseInt(match[2]) : (match[3] ? parseInt(match[3]) : 0);
        return hours * 60 + mins;
      };
      return getDuration(a.duration) - getDuration(b.duration);
    });
    
    // Group remaining activities by name with counts
    const remainingByName = remainingActivities.reduce((acc, act) => {
      if (!acc[act.name]) {
        acc[act.name] = { count: 0, cost: act.cost, duration: act.duration };
      }
      acc[act.name].count++;
      return acc;
    }, {} as Record<string, { count: number; cost: number; duration: number }>);
    
    const remainingSummary = Object.entries(remainingByName).map(([name, data]) => ({
      name,
      count: data.count,
      costPerActivity: data.cost,
      durationPerActivity: formatDuration(data.duration),
      totalCost: data.cost * data.count,
      totalDuration: formatDuration(data.duration * data.count),
    }));
    
    return {
      success: true,
      availableTime: formatDuration(availableMinutes),
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
        duration: formatDuration(activity.duration),
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
        acc[act.name] = { count: 0, cost: act.cost, duration: act.duration };
      }
      acc[act.name].count++;
      return acc;
    }, {} as Record<string, { count: number; cost: number; duration: number }>);
    
    const summary = Object.entries(byName).map(([name, data]) => ({
      name,
      count: data.count,
      costPerActivity: data.cost,
      durationPerActivity: formatDuration(data.duration),
      totalCost: data.cost * data.count,
      totalDuration: formatDuration(data.duration * data.count),
    }));
    
    const totalCost = remaining.reduce((sum, act) => sum + act.cost, 0);
    const totalDuration = remaining.reduce((sum, act) => sum + act.duration, 0);
    
    return {
      success: true,
      remaining: summary,
      totalRemaining: remaining.length,
      totalCost,
      totalDuration: formatDuration(totalDuration),
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

