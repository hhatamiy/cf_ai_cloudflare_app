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
 * Utility to truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Utility to detect rate limit errors in API responses
 */
function isRateLimitError(status: number): boolean {
  return status === 429 || status === 403;
}

/**
 * Weather information tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for read-only information that doesn't need oversight
 */
const getWeatherInformation = tool({
  description: "Get weather information for a given city. Returns weather data that you should then use to write a helpful response to the user.",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      // Access env through type assertion since it's protected but accessible at runtime
      const apiKey = (agent as any)?.env.OPENWEATHER_API_KEY;
      
      if (!apiKey) {
        return "Weather information is not configured. Please add OPENWEATHER_API_KEY to environment variables.";
      }
      
      console.log(`Getting weather information for ${city}`);
      
      // Use OpenWeatherMap API
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return `City "${city}" not found. Please check the spelling and try again.`;
        }
        if (response.status === 401) {
          return `Weather API authentication failed. This usually means:
1. Your API key is newly created and needs time to activate (can take up to 2 hours, usually much faster)
2. Your API key might be invalid

Please wait a few minutes and try again, or verify your OPENWEATHER_API_KEY in .dev.vars is correct.`;
        }
        if (isRateLimitError(response.status)) {
          return `Weather API rate limit reached. Free tier allows 1,000 calls per day. Please try again later or upgrade your API plan.`;
        }
        return `Unable to fetch weather data (Error ${response.status}). Please try again later.`;
      }
      
      const data = await response.json() as any;
      
      // Format weather information
      const weather = {
        city: data.name,
        country: data.sys.country,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed
      };
      
      return `Weather in ${weather.city}, ${weather.country}:
- Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)
- Conditions: ${weather.description}
- Humidity: ${weather.humidity}%
- Wind Speed: ${weather.windSpeed} m/s`;
    } catch (error) {
      console.error("Weather fetch error:", error);
      return `Error fetching weather: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "Get the local time for a specified location (city or timezone). Returns time data that you should then use to write a helpful response to the user.",
  inputSchema: z.object({ location: z.string().describe("City name or timezone (e.g., 'New York', 'America/New_York', 'London', 'Europe/London')") }),
  execute: async ({ location }) => {
    try {
      console.log(`Getting local time for ${location}`);
      
      // Try to use the location as a timezone first
      let timezone = location;
      
      // Common city to timezone mappings
      const cityTimezones: Record<string, string> = {
        'new york': 'America/New_York',
        'los angeles': 'America/Los_Angeles',
        'chicago': 'America/Chicago',
        'london': 'Europe/London',
        'paris': 'Europe/Paris',
        'tokyo': 'Asia/Tokyo',
        'sydney': 'Australia/Sydney',
        'dubai': 'Asia/Dubai',
        'singapore': 'Asia/Singapore',
        'hong kong': 'Asia/Hong_Kong',
        'mumbai': 'Asia/Kolkata',
        'delhi': 'Asia/Kolkata',
        'beijing': 'Asia/Shanghai',
        'shanghai': 'Asia/Shanghai',
        'moscow': 'Europe/Moscow',
        'berlin': 'Europe/Berlin',
        'toronto': 'America/Toronto',
        'vancouver': 'America/Vancouver',
        'san francisco': 'America/Los_Angeles',
        'seattle': 'America/Los_Angeles',
        'boston': 'America/New_York',
        'miami': 'America/New_York',
        'mexico city': 'America/Mexico_City',
        'sao paulo': 'America/Sao_Paulo',
        'buenos aires': 'America/Argentina/Buenos_Aires',
        'cairo': 'Africa/Cairo',
        'johannesburg': 'Africa/Johannesburg',
        'istanbul': 'Europe/Istanbul',
        'bangkok': 'Asia/Bangkok',
        'seoul': 'Asia/Seoul',
        'melbourne': 'Australia/Melbourne',
        'auckland': 'Pacific/Auckland'
      };
      
      // Check if location is a known city
      const normalizedLocation = location.toLowerCase().trim();
      if (cityTimezones[normalizedLocation]) {
        timezone = cityTimezones[normalizedLocation];
      }
      
      // Try to format the time using the timezone
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'long'
        });
        
        const timeString = formatter.format(now);
        return `Current time in ${location}:\n${timeString}`;
      } catch (timezoneError) {
        // If timezone is invalid, return a helpful error
        return `Unable to find timezone for "${location}". Please use a major city name (e.g., "New York", "London", "Tokyo") or a standard timezone format (e.g., "America/New_York", "Europe/London").`;
      }
    } catch (error) {
      console.error("Time fetch error:", error);
      return `Error fetching time: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

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
      
      // Limit response size: show max 20 tasks to prevent overflow
      const MAX_TASKS = 20;
      if (tasks.length > MAX_TASKS) {
        const limitedTasks = tasks.slice(0, MAX_TASKS);
        return {
          tasks: limitedTasks,
          message: `Showing ${MAX_TASKS} of ${tasks.length} tasks. Use cancelScheduledTask to remove tasks and see more.`
        };
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
  description: "Search the web for current information, news, facts, or any topic. Use this when you need up-to-date information that you don't already know. Returns search results that you should then use to write a comprehensive response answering the user's question.",
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
      
      // Build URL with required parameters - limit to 3 results to keep responses manageable
      const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('count', '3'); // Reduced from 5 to 3 for smaller responses
      
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        }
      });
      
      if (!response.ok) {
        if (isRateLimitError(response.status)) {
          return `Search API rate limit reached. Free tier allows 2,000 searches per month. Please try again later or upgrade your API plan.`;
        }
        const errorText = await response.text();
        console.error(`Brave Search API error: ${response.status} - ${errorText}`);
        return `Search temporarily unavailable (Error ${response.status}). Please try again.`;
      }
      
      const data = await response.json() as any;
      
      // Format top results for the AI - limit to 3 and truncate descriptions
      const MAX_DESCRIPTION_LENGTH = 200;
      const results = data.web?.results?.slice(0, 3).map((r: any) => ({
        title: truncateText(r.title, 100),
        description: truncateText(r.description, MAX_DESCRIPTION_LENGTH),
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
 * 
 * Currently, all tools auto-execute, so this object is empty.
 */
export const executions = {
  // No tools currently require confirmation - all auto-execute
};
