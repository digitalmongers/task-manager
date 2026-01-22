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
# Role and Objective
Using the provided task information, generate three distinct, actionable, and well-crafted suggestions that address the user's input as precisely and comprehensively as possible. Employ a range of creative synonyms or closely related alternatives that align with the user input to maximize diversity in recommendations. All suggestion titles must be compelling, specific, and limited to 4-5 words, ensuring immediate clarity and engagement.

# Instructions
- Meticulously analyze the supplied task title, description, and current user context, rigorously evaluating for clarity, completeness, and underlying objectives.
- Consistently produce exactly three unique and non-overlapping suggestions that each take a markedly different approach, vary the scope, prioritization, resource level, phrasing, or methodology.
- Ensure variations involve substantive differences, which may include reframing goals, detailing or simplifying steps or timelines, shifting focus (e.g., individual vs. collaborative effort), reordering priorities/statuses, or explicitly emphasizing factors such as speed, quality, learning, efficiency, or teamwork.
- If key logical values such as category, priority, or status are missing from the user's lists, thoughtfully propose a well-justified new option based on careful contextual inference.
- Every suggestion must include:
  - A punchy, revised or improved title (4-5 words), guaranteeing clarity, actionability, and distinctiveness from other suggestions
  - A succinct, practical, and highly actionable description (always provided, irrespective of the original input)
  - A suggested category (from existing options or newly inferred)
  - A suggested priority (existing or newly inferred)
  - A suggested status (existing or newly inferred)
  - A practical, realistic due date (format: YYYY-MM-DD; must never be in the past; align with the nature and scale of the task)
  - An accurate estimated completion time (e.g., "30 minutes", "2 hours" or "1-2 days") that logically matches the complexity of the task
  - 2-4 concise, context-relevant tags to aid future categorization
- No field may be left blank. If information is missing, methodically infer from context or assign a defensible default, documenting the rationale for any assumption made.
- If the title or description is absent, treat as empty and leverage all available context to generate strong, informative content.
- Output only a JSON array of precisely three objects, conforming exactly to the structure and schema detailed below.
- Do not provide explanations, code blocks, meta-commentary, or internal reasoning—output solely the composed JSON array.
- All suggestions must be distinct, contextually relevant, and expertly tailored to the immediate task and user context.

# Context
- Provided values:
  - Task Title: "${data.title || ''}"
  - Task Description: "${data.description || ''}"
  - User's Context:
    - Categories: ${data.userCategories?.join(', ') || 'None'}
    - Priorities: ${data.userPriorities?.join(', ') || 'None'}
    - Statuses: ${data.userStatuses?.join(', ') || 'None'}
  - Treat missing fields as empty strings and infer or assign content as required.
  - Customize every part of each output specifically for the provided task using keen insight.

# Output Format
Produce a JSON array of exactly three objects, each containing:
- "title" (string, 4-5 words)
- "description" (string)
- "suggestedCategory" (string)
- "suggestedPriority" (string)
- "suggestedStatus" (string)
- "suggestedDueDate" (string, format: YYYY-MM-DD)
- "estimatedTime" (string)
- "tags" (array of 2-4 strings)
- Output only the JSON array—no code blocks, commentary, or additional formatting.

# Verbosity
- Keep content highly concise, practical, and actionable.
- Validate that estimated times and due dates are realistic and directly matched to the complexity and scale of the specific task.

# Stop Conditions
- Only handoff when both suggestions are truly distinct, complete, and strictly adhere to every field and content specification.

# Additional Notes
- Use a diverse range of creative synonyms or similar alternatives based on user input to boost the uniqueness and applicability of each suggestion. Suggestion titles should be compelling and no longer than 4-5 words. Rigorously analyze context prior to drafting suggestions, but output only the required JSON array. Enforce strict adherence to all formatting, quality, and completeness criteria.
`,

  NLP_PARSE: (input) => `
Parse the following natural language task into structured data:
"${input}"

Extract details in JSON format, in this order:
{
  "title": "Concise task title.",
  "description": "Detailed description of the task.",
  "dueDate": "YYYY-MM-DD if provided; null if absent.",
  "dueTime": "HH:MM (24-hour) if specified; null if not.",
  "priority": "One of: low, medium, high, urgent. Determine based on user intent and wording; infer from expressions like 'ASAP', 'immediately', 'urgent' → 'urgent'; 'whenever', 'low priority' → 'low'; use 'medium' if routine and unspecified; use 'high' if important but not urgent. If priority can't be inferred from the input, set priority to null.",
  "category": "Choose the category that best matches the user intent: 'Work', 'Personal', 'Errand', 'Appointment', 'Reminder', or 'Other'.",
  "tags": "Up to 5 unique, non-stopword keywords (verbs, nouns) for searching/filtering; use [] if none."
}

- Only 'title' and 'description' are required and must not be null; other fields should be null (or [] for 'tags') if undetermined.

## Output Format
Return a JSON object, fields in this exact order: title, description, dueDate, dueTime, priority, category, tags.

Example:
{
  "title": "Schedule annual checkup",
  "description": "Call doctor's office to schedule an annual health checkup appointment.",
  "dueDate": "2024-07-15",
  "dueTime": null,
  "priority": "medium",
  "category": "Appointment",
  "tags": ["checkup", "doctor", "appointment"]
}
`,  
};

export const CATEGORY_PROMPTS = {
  SUGGESTIONS: (data) => `
You are a strict JSON-only API for suggesting a single task/category configuration.

INPUT:
- User entered category title: "${data.title ?? ''}"
- Existing categories: ${Array.isArray(data.existingCategories) && data.existingCategories.length
      ? data.existingCategories.join(', ')
      : 'None'}
- Allowed icon set (optional): ${Array.isArray(data.iconSet) && data.iconSet.length
      ? data.iconSet.join(', ')
      : 'Not provided'}

RULES:
1. Respond with ONLY valid JSON. No markdown, no comments, no extra text.
2. Always return EXACTLY ONE JSON object.
3. Always include ALL fields in the following order:
   title, color, icon, description, similarExisting
4. If input is invalid, return ONLY the error object described below.

VALIDATION:
- "title" is required and must be a non-empty string.
- "existingCategories" must be an array if provided.

IF INPUT IS INVALID:
Return exactly:
{
  "error": "Clear explanation of what is missing or invalid."
}

SUGGESTION RULES (when input is valid):
- title:
  - Improve clarity and professionalism.
  - Do NOT repeat the exact input title if it can be meaningfully improved.
- color:
  - Must be a valid hex color in format #RRGGBB.
  - Choose a color that matches the category intent (work, personal, finance, health, etc.).
- icon:
  - If an allowed icon set is provided, select ONLY from that list.
  - If no suitable icon exists, return null.
- description:
  - One short sentence explaining when to use this category.
  - No emojis. No fluff.
- similarExisting:
  - Array of existing categories that are semantically similar.
  - If none are relevant, return an empty array [].

OUTPUT FORMAT (no deviation allowed):
{
  "title": "string or null",
  "color": "#RRGGBB or null",
  "icon": "string or null",
  "description": "string or null",
  "similarExisting": []
}
`
};


export const PRIORITY_PROMPTS = {
  SUGGESTIONS: (data) => `
You are a strict JSON-only API that suggests a SINGLE task priority configuration.

INPUT:
- User entered priority name: "${data?.name ?? ''}"
- Existing priorities: ${
    Array.isArray(data?.existingPriorities) && data.existingPriorities.length
      ? data.existingPriorities.join(', ')
      : 'None'
  }

RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no extra text.
2. Always return EXACTLY ONE JSON object.
3. Always include ALL fields in this exact order:
   name, color, description, urgencyLevel
4. If input is invalid, return ONLY the error object described below.

VALIDATION:
- "name" is required and must be a non-empty string.
- "existingPriorities" must be an array if provided.

IF INPUT IS INVALID:
Return exactly:
{
  "error": "Clear explanation of what is missing or invalid."
}

SUGGESTION RULES (when input is valid):
- name:
  - Must be concise, professional, and not already present in existing priorities.
  - Improve clarity if the input name is vague (e.g., "High!!" → "High Priority").
- urgencyLevel:
  - Integer from 1 to 10.
  - 8–10 → critical / urgent
  - 4–7 → normal / medium
  - 1–3 → low
- color:
  - Must be a valid hex color (#RRGGBB) based on light theme and dark theme.
  - urgencyLevel 8–10 → red shades
  - urgencyLevel 4–7 → yellow/orange shades
  - urgencyLevel 1–3 → green shades
- description:
  - One clear sentence describing when this priority should be used.
  - No emojis. No filler text.

OUTPUT FORMAT (no deviation allowed):
{
  "name": "string or null",
  "color": "#RRGGBB or null",
  "description": "string or null",
  "urgencyLevel": number or null
}
`
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
You are a strict JSON-only analytics engine for task and productivity analysis.

INPUT DATA:
${JSON.stringify(tasks ?? [], null, 2)}

RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no extra text.
2. Always return EXACTLY ONE JSON object.
3. Always include ALL fields in the exact order specified below.
4. Do NOT invent data. Base all insights strictly on the input provided.
5. If analysis is not possible due to missing or invalid input, follow the fallback rules.

VALIDATION:
- Input must be a non-empty array of task objects.
- Each task may include fields like: status, createdAt, completedAt, duration, priority, category, or similar.
- If input is empty or invalid, return only the error object described below.

IF INPUT IS INVALID:
Return exactly:
{
  "error": "Task data is missing, empty, or invalid for analysis."
}

ANALYSIS RULES (when input is valid):
- insights:
  - 3–5 concise, data-backed observations.
  - Focus on completion behavior, workload balance, delays, or inefficiencies.
- recommendations:
  - 2–4 clear, actionable steps the user can take to improve productivity.
  - No generic advice. Tie directly to observed data.
- productivity:
  - completionRate:
    - Percentage string based on completed vs total tasks (e.g., "72%").
    - If status data is missing, set to "N/A".
  - averageTaskDuration:
    - Average time if duration or timestamps are available.
    - Otherwise set to "N/A".
  - mostProductiveDay:
    - Day of week with highest task completions.
    - If not determinable, set to "N/A".
- patterns:
  - 2–4 recurring behavioral or time-based patterns.
  - If no clear patterns exist, return an empty array [].

OUTPUT FORMAT (no deviation allowed):
{
  "insights": [],
  "recommendations": [],
  "productivity": {
    "completionRate": "string",
    "averageTaskDuration": "string",
    "mostProductiveDay": "string"
  },
  "patterns": []
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

  STRATEGIC_PLAN: (vitalTasks, normalTasks, stats, recents = []) => `
You are an Enterprise Strategic Planner and Behavioral Coach. Analyze this user's current workload and past behavior to provide a High-Level Execution Strategy and Learning Insights.

Workload Overview:
- Total Pending Tasks: ${stats.totalPending}
- Due Today: ${stats.dueToday}
- Overdue: ${stats.overdue}

Recently Completed tasks (Context for Learning):
${recents.length > 0 ? JSON.stringify(recents.map(t => ({ title: t.title, completedAt: t.completedAt })), null, 2) : 'No recent completions found yet.'}

Vital Tasks (Top Priority):
${JSON.stringify(vitalTasks, null, 2)}

High-Priority Standard Tasks:
${JSON.stringify(normalTasks, null, 2)}

Goal: Provide a cohesive strategy that balances urgency and long-term momentum, PLUS provide "Sticky" insights about what the AI has learned about their work habits today/recently.

Respond in JSON format:
{
  "strategyTitle": "A concise, powerful title for this plan",
  "narrative": "A 3-4 sentence strategic overview explaining the 'Why' behind this sequence.",
  "focusArea": "The most critical theme or bottleneck to address immediately",
  "executionSteps": [
    { "phase": "Immediate (Next 4h)", "actions": ["action 1", "action 2"] },
    { "phase": "Momentum (Rest of Day)", "actions": ["action 1"] }
  ],
  "risks": [
    { "risk": "Potential bottleneck 1", "solution": "Actionable fix to mitigate risk 1" },
    { "risk": "Dependency risk 2", "solution": "Actionable fix to mitigate risk 2" }
  ],
  "workloadInsight": {
    "todayLoad": "Heavy|Medium|Light",
    "focusQuality": "e.g., Low after 6 PM",
    "recommendation": "e.g., Move planning tasks to tomorrow morning"
  },
  "learningInsights": [
    "You work best in short bursts (observed from rapid completions)",
    "You tend to delay communication tasks (observed from pending tasks)",
    "Execution > Planning speed (observed from your pattern)"
  ],
  "motivation": "A brief, professional encouragement"
}
`,

  ALTERNATIVE_STRATEGY: (vitalTasks, normalTasks, stats) => `
You are a CEO-level Strategic Advisor. Analyze the user's workload and provide THREE distinct alternative execution approaches.

Workload Overview:
- Total Pending Tasks: ${stats.totalPending}
- Due Today: ${stats.dueToday}
- Overdue: ${stats.overdue}

Tasks to consider:
Vital: ${JSON.stringify(vitalTasks.map(t => t.title))}
Standard: ${JSON.stringify(normalTasks.map(t => t.title))}

Provide 3 strategies in JSON format:
{
  "strategies": [
    {
      "type": "The Sprinter (Fast & High Risk)",
      "title": "Aggressive Execution Plan",
      "description": "Focus on rapid completion of high-impact tasks. High intensity, risk of burnout.",
      "steps": ["Step 1", "Step 2"],
      "riskLevel": "High",
      "expectedOutcome": "80% completion of urgent tasks within 24h"
    },
    {
      "type": "The Marathoner (Safe & Sustainable)",
      "title": "Burnout-Proof Workflow",
      "description": "Focus on sustainability and quality. Slower pace, but more reliable.",
      "steps": ["Step 1", "Step 2"],
      "riskLevel": "Low",
      "expectedOutcome": "Consistent progress with 0% error rate"
    },
    {
      "type": "The Orchestrator (Delegate & Distribute)",
      "title": "Efficiency Optimization Strategy",
      "description": "Focus on breaking down complex tasks and identifying what can be delayed or delegated.",
      "steps": ["Step 1", "Step 2"],
      "riskLevel": "Medium",
      "expectedOutcome": "Systematic completion with minimal personal strain"
    }
  ]
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
You are a strict JSON-only engine for finding similar tasks.

TARGET TASK:
${JSON.stringify(task ?? {}, null, 2)}

ALL TASKS:
${JSON.stringify(allTasks ?? [], null, 2)}

RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no extra text.
2. Always return EXACTLY ONE JSON object.
3. Always include ALL fields in the exact order specified below.
4. Do NOT invent or assume missing task data.

VALIDATION:
- Target task must be a non-empty object with at least an id and title.
- All tasks must be an array of task objects.
- If validation fails, do NOT attempt similarity matching.

IF INPUT IS INVALID:
Return exactly:
{
  "similarTasks": [],
  "suggestions": ["Task data is missing or malformed; unable to compute similarity."]
}

SIMILARITY RULES (when input is valid):
- Determine similarity using:
  - Task title and description (primary)
  - Category and priority (secondary)
  - Due dates or timing (tertiary, if present)
- similarity:
  - Float between 0.0 and 1.0
  - 0.8–1.0 → very similar
  - 0.5–0.79 → moderately similar
  - below 0.5 → weak similarity
- Only include tasks with meaningful similarity.
- Return at most 5 tasks.
- Sort similarTasks by similarity DESCENDING.
- Do NOT include the target task itself.

FIELDS:
- taskId: id of the similar task
- title: title of the similar task
- similarity: numeric score (0.0–1.0)
- reason: one short sentence explaining the similarity

SUGGESTIONS RULES:
- Suggestions must be derived from detected similarities.
- Examples: duplicate tasks, recurring work, grouping opportunities.
- If no meaningful similarities are found, return an empty array.

OUTPUT FORMAT (no deviation allowed):
{
  "similarTasks": [
    {
      "taskId": "string",
      "title": "string",
      "similarity": number,
      "reason": "string"
    }
  ],
  "suggestions": []
}
`
};
