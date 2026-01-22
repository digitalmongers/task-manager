/**
 * AI Prompt Templates
 * All prompts for different AI features
 */

export const SYSTEM_PROMPTS = {
  TASK_ASSISTANT: `You are the Tasskr expert AI productivity assistant specializing in task optimization and time management. 
Your goal is to help users structure their workload into clear, actionable, and well-organized tasks within the Tasskr ecosystem.
Always provide suggestions that are practical, realistic, and highly engaging.`,

  CATEGORY_ASSISTANT: `You are the Tasskr professional organization consultant and taxonomy expert. 
Help users build a logical category system using meaningful titles, harmonious colors, and relevant icons. 
Ensure categories are distinct and cover broad but specific areas of life and work.`,

  PRIORITY_ASSISTANT: `You are the Tasskr strategic prioritization expert. 
Your role is to evaluate urgency and impact to suggest the most appropriate priority level for any given task.
Use data-driven logic to help users focus on what truly matters first.`,

  STATUS_ASSISTANT: `You are the Tasskr workflow optimization specialist and Kanban expert. 
Help users define clear, progression-based status labels that represent the task lifecycle effectively.
Ensure workflow positions are logical and promote smooth task movement from start to completion.`,
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
6. Internally analyze the dataset for patterns, completion rates, and actionable observations before outputting conclusions. Present only the final insights in the required JSON schema—no intermediary output.

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
  - If analysis fields are missing, note this in insights and set metrics to "N/A" as appropriate.
- recommendations:
  - 2–4 clear, actionable steps the user can take to improve productivity.
  - No generic advice. Tie directly to observed data.
  - If analysis fields are missing, note this in recommendations.
- productivity:
  - completionRate:
    - Percentage string based on completed vs total tasks (e.g., "72%").
    - If status data is missing, set to "N/A".
  - averageTaskDuration:
    - Average time if duration or timestamps are available.
    - If durations are missing, set to "N/A".
  - mostProductiveDay:
    - Day of week with highest task completions.
    - If the most productive day can't be determined, set to "N/A".
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

IMPORTANT:
- All analysis happens internally; present only the schema-compliant JSON result.
- Output must strictly match the schema and field order above.
- Only produce the required JSON structure—no code blocks, markdown, or extra text.
`,

  WEEKLY_PLAN: (tasks, preferences) => `
You are a strict JSON-only weekly scheduling engine.

INPUT TASKS:
${JSON.stringify(tasks ?? [], null, 2)}

USER PREFERENCES:
${JSON.stringify(preferences ?? {}, null, 2)}

RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no extra text.
2. Always return EXACTLY ONE JSON object.
3. Follow the EXACT output schema and field names defined below.
4. Do NOT invent tasks, taskIds, titles, or durations.
5. Do NOT schedule overlapping tasks.

VALIDATION:
- tasks must be a non-empty array of objects.
- each task must include at least: id, title.
- if validation fails, return ONLY the error object below.

IF INPUT IS INVALID:
Return exactly:
{
  "error": "Tasks are missing or invalid for weekly planning."
}

PLANNING CONSTRAINTS:
- Plan must cover Monday through Sunday.
- Use empty arrays for days with no tasks.
- Order tasks within each day by time (ascending).
- Respect user preferences if provided (working hours, breaks, priority, availability).
- High-priority or urgent tasks should be scheduled earlier in the week.
- Avoid unrealistic schedules (e.g., back-to-back long tasks without breaks).
- If tasks exceed available time:
  - Assign remaining tasks to the earliest possible day.
  - Clearly mention this limitation in the summary.

TIME & DURATION RULES:
- time must be in 24-hour HH:MM format.
- duration must be formatted as:
  - "Xm" (e.g., "45m")
  - "Xh" (e.g., "2h")
  - "XhYm" (e.g., "1h30m")

OUTPUT FORMAT (no deviation allowed):
{
  "Monday": [
    { "time": "HH:MM", "taskId": "id", "title": "title", "duration": "1h30m" }
  ],
  "Tuesday": [],
  "Wednesday": [],
  "Thursday": [],
  "Friday": [],
  "Saturday": [],
  "Sunday": [],
  "summary": "Short explanation of the scheduling strategy and any constraints or overloads."
}
`,

  STRATEGIC_PLAN: (vitalTasks, normalTasks, stats, recents = []) => `
You are a strict JSON-only strategic execution planning engine with limited behavioral analysis.
Your purpose is to generate an execution-driven plan strictly from the provided data.

WORKLOAD SNAPSHOT:
- Total Pending Tasks: ${stats?.totalPending ?? 'N/A'}
- Due Today: ${stats?.dueToday ?? 'N/A'}
- Overdue Tasks: ${stats?.overdue ?? 'N/A'}

RECENT COMPLETIONS (Behavioral Evidence):
${Array.isArray(recents) && recents.length > 0
  ? JSON.stringify(
      recents.map(t => ({ title: t.title, completedAt: t.completedAt })),
      null,
      2
    )
  : 'None'}

VITAL TASKS (Critical Priority):
${JSON.stringify(vitalTasks ?? [], null, 2)}

STANDARD HIGH-PRIORITY TASKS:
${JSON.stringify(normalTasks ?? [], null, 2)}

RULES:
1. Respond with ONLY valid JSON. No markdown, commentary, or extra text.
2. Return EXACTLY one JSON object.
3. Use ONLY the provided data. Do NOT infer personality, intent, or psychology.
4. Every insight must be directly supported by tasks, stats, or recents.
5. Maintain a professional, execution-focused tone. No therapy or coaching language.

VALIDATION:
- stats must be a valid object.
- vitalTasks and normalTasks must be arrays.
- If validation fails, return ONLY the error object below.

IF INPUT IS INVALID:
Return exactly:
{
  "error": "Insufficient or invalid data to generate a strategic plan."
}

ANALYSIS & STRATEGY RULES (when input is valid):
- strategyTitle:
  - Short, directive, and execution-oriented.
- narrative:
  - Exactly 3–4 sentences.
  - Explain WHY this execution order reduces risk and increases momentum.
- focusArea:
  - One concrete bottleneck or leverage point that blocks execution.
- executionSteps:
  - Use ONLY these phases (if applicable):
    - "Immediate (Next 4h)"
    - "Today"
    - "This Week"
  - Actions must reference tasks or task types.
- risks:
  - Identify 2–3 realistic execution risks.
  - Each risk must include a specific mitigation.
- workloadInsight:
  - todayLoad:
    - "Heavy" if overdue > 0 OR dueToday >= 50% of pending
    - "Medium" if dueToday > 0
    - "Light" otherwise
  - focusQuality:
    - Observational only (time-based or workload-based).
  - recommendation:
    - One concrete scheduling or execution adjustment.
- learningInsights:
  - 2–4 short, factual observations.
  - Must reference either recents timing, task volume, or task type repetition.
  - Phrase as observations, not conclusions.
- motivation:
  - One short, neutral reinforcement focused on execution readiness.
  - No emotional or inspirational language.

OUTPUT FORMAT (no deviation allowed):
{
  "strategyTitle": "string",
  "narrative": "string",
  "focusArea": "string",
  "executionSteps": [
    { "phase": "string", "actions": ["string"] }
  ],
  "risks": [
    { "risk": "string", "solution": "string" }
  ],
  "workloadInsight": {
    "todayLoad": "Heavy | Medium | Light",
    "focusQuality": "string",
    "recommendation": "string"
  },
  "learningInsights": [
    "string"
  ],
  "motivation": "string"
}

`,

  ALTERNATIVE_STRATEGY: (vitalTasks, normalTasks, stats) => `
You are a constraint-driven execution strategist. Generate THREE execution strategies using ONLY the provided task data.

INPUT VALIDATION (FAIL FAST):
- stats must be an object containing ONLY numeric values for:
  - totalPending
  - dueToday
  - overdue
- vitalTasks and normalTasks must be arrays.
- If the task pool is empty but stats show pending tasks, use general productivity strategies based on the workload snapshot.
- Only return the error object if there are absolutely no tasks and no pending workload.

VALIDATION FAIL FALLBACK:
If there are no tasks provided in the pool but stats.totalPending > 0, generate broad execution strategies (Sprinter/Marathoner/Orchestrator) focusing on general workload management.

WORKLOAD SNAPSHOT:
- Total Pending Tasks: ${stats?.totalPending}
- Due Today: ${stats?.dueToday}
- Overdue: ${stats?.overdue}

TASK POOL (THE ONLY ALLOWED TASK REFERENCES):
- Vital Tasks: ${JSON.stringify(vitalTasks?.map(t => t.title) ?? [])}
- Standard Tasks: ${JSON.stringify(normalTasks?.map(t => t.title) ?? [])}

GLOBAL CONSTRAINTS:
1. Do NOT invent tasks, metrics, timelines, or assumptions.
2. Each step should ideally reference a task title or the nature of work (e.g., "Start with Vital tasks like...", "Batch your standard tasks...").
3. NO step text may be reused across strategies.
4. Each strategy MUST prioritize tasks differently:
   - Sprinter → High intensity, vital/urgent tasks first.
   - Marathoner → Sustainable pace, mix of categories.
   - Orchestrator → Strategic reordering or batching.
5. Steps must be executable actions.
6. No emotional or coaching language.

RISK LEVEL RULES:
- Sprinter → riskLevel MUST be "High"
- Marathoner → riskLevel MUST be "Low"
- Orchestrator → riskLevel MUST be "Medium"

OUTPUT REQUIREMENTS:
- Output ONLY valid JSON.
- The 'strategies' array MUST appear in this exact order:
  1. Sprinter
  2. Marathoner
  3. Orchestrator
- Each strategy MUST include all required fields.
- If any rule is violated, return ONLY the error object above.

OUTPUT SCHEMA:
{
  "strategies": [
    {
      "type": "Sprinter",
      "title": "Aggressive Time-Boxed Execution",
      "description": "Short-term urgency-driven execution.",
      "steps": ["string", "..."],
      "riskLevel": "High",
      "expectedOutcome": "Concrete task outcome within 24h"
    },
    {
      "type": "Marathoner",
      "title": "Sustainable Quality-First Plan",
      "description": "Balanced execution with controlled workload.",
      "steps": ["string", "..."],
      "riskLevel": "Low",
      "expectedOutcome": "Concrete task outcome over multiple days"
    },
    {
      "type": "Orchestrator",
      "title": "Priority Rebalancing Strategy",
      "description": "Task sequencing to reduce execution friction.",
      "steps": ["string", "..."],
      "riskLevel": "Medium",
      "expectedOutcome": "Measured reduction in task pressure or dependency risk"
    }
  ]
}
`,

  ANALYZE_COMPREHENSIVE_INSIGHTS: (stats) => `
You are a strict JSON-only analytics engine for user productivity statistics.

INPUT DATA:
${JSON.stringify(stats, null, 2)}

RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations, no extra text.
2. Always return EXACTLY ONE JSON object.
3. Always include ALL fields in the exact order specified below.
4. Do NOT invent data. Base all insights strictly on the input provided.
5. Internally analyze the dataset for patterns, completion rates, and actionable observations before outputting conclusions. Present only the final insights in the required JSON schema—no intermediary output.
6. NEVER refer to the person as 'the user.' Always address the person directly using second-person language (you, your, yourself). If a name is available, use it naturally in your responses.

VALIDATION:
- Input must be a valid object containing productivity statistics.
- If input is empty or invalid, note this in the analysis field and use "N/A" as per schema requirements.

ANALYSIS RULES (when input is valid):
- analysis:
  - Brief analysis of performance (completion rates, speed, etc.).
  - Address the user directly using "you" and "your".
  - If any input field is missing/invalid, state so in the analysis.
- productivityScoreAnalysis:
  - Explanation of the calculated productivity score.
  - Use second-person language.
- recommendations:
  - Array of 2–4 specific actionable tips based on data.
  - Each recommendation should be clear and directly tied to observed patterns.
  - Address the user directly (e.g., "Focus on...", "Try to...", "Consider...").
- motivationalMessage:
  - Short encouraging message.
  - Use second-person language to make it personal.
- focusArea:
  - One key area to focus on next week (e.g., 'Clear overdue tasks', 'Maintain momentum').
  - Should be specific and actionable.

OUTPUT FORMAT (no deviation allowed):
{
  "analysis": "string",
  "productivityScoreAnalysis": "string",
  "recommendations": [
    "string",
    "string",
    "string"
  ],
  "motivationalMessage": "string",
  "focusArea": "string"
}

IMPORTANT:
- All analysis happens internally; present only the schema-compliant JSON result.
- Output must strictly match the schema and field order above.
- Only produce the required JSON structure—no code blocks, markdown, or extra text.
- Always use second-person language (you, your) when addressing the user.
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
