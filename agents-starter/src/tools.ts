/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    
    // Get current time in the requested location
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
      timeZone: getTimezone(location),
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
    
    return `The current time in ${location} is ${timeString}.`;
  }
});

// Helper function to map locations to timezones
function getTimezone(location: string): string {
  const timezones: Record<string, string> = {
    'new york': 'America/New_York',
    'nyc': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    'la': 'America/Los_Angeles',
    'chicago': 'America/Chicago',
    'london': 'Europe/London',
    'paris': 'Europe/Paris',
    'tokyo': 'Asia/Tokyo',
    'sydney': 'Australia/Sydney',
    'san francisco': 'America/Los_Angeles',
    'seattle': 'America/Los_Angeles',
    'boston': 'America/New_York',
  };
  
  const key = location.toLowerCase();
  return timezones[key] || 'America/New_York'; // Default to ET
}

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Web search tool that executes automatically
 * Uses Brave Search API to search the web for current information
 */
const searchWeb = tool({
  description: "Search the web for current information, news, facts, or any topic. Use this when you need up-to-date information that you don't already know.",
  inputSchema: z.object({ 
    query: z.string().describe("The search query")
  }),
  execute: async ({ query }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      // Access env through type assertion since it's protected but accessible at runtime
      const apiKey = (agent as any)?.env.BRAVE_SEARCH_API_KEY;
      
      if (!apiKey) {
        return "Web search is not configured. Please add BRAVE_SEARCH_API_KEY to environment variables.";
      }
      
      console.log(`Searching web for: ${query}`);
      
      // Build URL with required parameters
      const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('count', '5'); // Number of results
      
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Brave Search API error: ${response.status} - ${errorText}`);
        return `Search temporarily unavailable (Error ${response.status}). Please try again.`;
      }
      
      const data = await response.json() as any;
      
      // Format top results for the AI
      const results = data.web?.results?.slice(0, 5).map((r: any) => ({
        title: r.title,
        description: r.description,
        url: r.url
      })) || [];
      
      if (results.length === 0) {
        return `No results found for "${query}".`;
      }
      
      // Format results in a readable way
      const formattedResults = results.map((r: any, i: number) => 
        `${i + 1}. ${r.title}\n   ${r.description}\n   ${r.url}`
      ).join('\n\n');
      
      return `Search results for "${query}":\n\n${formattedResults}`;
    } catch (error) {
      console.error("Web search error:", error);
      return `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  searchWeb
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  }
};
