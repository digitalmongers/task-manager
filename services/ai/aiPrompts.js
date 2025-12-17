/**
 * AI Prompt Templates
 * All prompts for different AI features
 */

export const SYSTEM_PROMPTS = {
  TASK_ASSISTANT: `You are an intelligent task management assistant. Help users create and organize tasks efficiently. 
Provide concise, actionable suggestions. Always respond in valid JSON format.`,

  CATEGORY_ASSISTANT: `You are a task categorization expert. Help users create meaningful categories with appropriate colors.
Provide concise suggestions. Always respond in valid JSON format.`,

  PRIORITY_ASSISTANT: `You are a priority management expert. Help users define priority levels with appropriate urgency indicators.
Provide concise suggestions. Always respond in valid JSON format.`,

  STATUS_ASSISTANT: `You are a workflow expert. Help users create status labels that represent task states clearly.
Provide concise suggestions. Always respond in valid JSON format.`,
};

export const TASK_PROMPTS = {
  SUGGESTIONS: (data) => `
Given the following task information:
Title: "${data.title || ''}"
Description: "${data.description || ''}"

User's existing context:
- Categories: ${data.userCategories?.join(', ') || 'None'}
- Priorities: ${data.userPriorities?.join(', ') || 'None'}
- Statuses: ${data.userStatuses?.join(', ') || 'None'}

Provide smart suggestions for this task. Respond in JSON format:
{
  "title": "improved or completed title",
  "description": "helpful description if not provided",
  "suggestedCategory": "best matching category from user's list or suggest new",
  "suggestedPriority": "appropriate priority level",
  "suggestedStatus": "appropriate status",
  "suggestedDueDate": "YYYY-MM-DD format, realistic deadline",
  "estimatedTime": "estimated time to complete (e.g., '2 hours', '1 day')",
  "tags": ["relevant", "tags"]
}
`,

  NLP_PARSE: (input) => `
Parse this natural language task input into structured data:
"${input}"

Extract and return in JSON format:
{
  "title": "concise task title",
  "description": "detailed description",
  "dueDate": "YYYY-MM-DD if mentioned, null otherwise",
  "dueTime": "HH:MM if mentioned, null otherwise",
  "priority": "low/medium/high/urgent based on context",
  "category": "suggested category based on task type",
  "tags": ["extracted", "keywords"]
}
`,
};

export const CATEGORY_PROMPTS = {
  SUGGESTIONS: (data) => `
User wants to create a category with title: "${data.title || ''}"

Existing categories: ${data.existingCategories?.join(', ') || 'None'}

Provide suggestions in JSON format:
{
  "title": "improved category name",
  "color": "hex color code appropriate for this category",
  "icon": "suggested icon name",
  "description": "brief description of when to use this category",
  "similarExisting": ["list", "of", "similar", "existing", "categories"]
}
`,
};

export const PRIORITY_PROMPTS = {
  SUGGESTIONS: (data) => `
User wants to create a priority level with name: "${data.name || ''}"

Existing priorities: ${data.existingPriorities?.join(', ') || 'None'}

Provide suggestions in JSON format:
{
  "name": "clear priority name",
  "color": "hex color code (red for urgent, yellow for medium, green for low)",
  "description": "when to use this priority level",
  "urgencyLevel": "number from 1-10"
}
`,
};

export const STATUS_PROMPTS = {
  SUGGESTIONS: (data) => `
User wants to create a status with name: "${data.name || ''}"

Existing statuses: ${data.existingStatuses?.join(', ') || 'None'}

Provide suggestions in JSON format:
{
  "name": "clear status name",
  "color": "hex color code appropriate for this status state",
  "description": "what this status represents",
  "workflowPosition": "start/progress/review/done"
}
`,
};

export const INSIGHTS_PROMPTS = {
  ANALYZE_TASKS: (tasks) => `
Analyze these tasks and provide insights:
${JSON.stringify(tasks, null, 2)}

Provide analysis in JSON format:
{
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"],
  "productivity": {
    "completionRate": "percentage",
    "averageTaskDuration": "time",
    "mostProductiveDay": "day of week"
  },
  "patterns": ["observed pattern 1", "observed pattern 2"]
}
`,

  WEEKLY_PLAN: (tasks, preferences) => `
Create an optimized weekly plan for these tasks:
${JSON.stringify(tasks, null, 2)}

User preferences:
${JSON.stringify(preferences, null, 2)}

Provide weekly plan in JSON format:
{
  "Monday": [{"time": "HH:MM", "taskId": "id", "title": "title", "duration": "time"}],
  "Tuesday": [...],
  ...
  "summary": "brief explanation of the planning strategy"
}
`,

  ANALYZE_COMPREHENSIVE_INSIGHTS: (stats) => `
Analyze the following user productivity statistics for the Dashboard Insights:
${JSON.stringify(stats, null, 2)}

Provide a comprehensive analysis in JSON format:
{
  "analysis": "Brief analysis of performance (completion rates, speed, etc.)",
  "productivityScoreAnalysis": "Explanation of the calculated productivity score",
  "recommendations": [
    "Specific actionable tip 1 based on data",
    "Specific actionable tip 2 based on data",
    "Specific actionable tip 3 based on data"
  ],
  "motivationalMessage": "Short encouraging message",
  "focusArea": "One key area to focus on next week (e.g., 'Clear overdue tasks', 'Maintain momentum')"
}
`,
};

export const SIMILARITY_PROMPTS = {
  FIND_SIMILAR: (task, allTasks) => `
Find tasks similar to this one:
Target task: ${JSON.stringify(task, null, 2)}

All tasks:
${JSON.stringify(allTasks, null, 2)}

Provide similar tasks in JSON format:
{
  "similarTasks": [
    {
      "taskId": "id",
      "title": "title",
      "similarity": 0.0-1.0,
      "reason": "why it's similar"
    }
  ],
  "suggestions": ["suggestion based on similar tasks"]
}
`,
};
