const TEMPLATE_JSON = `{
  "courseId": "COURSE_ID_HERE",
  "courseName": "Full Course Name",
  "courseCode": "CODE",
  "tools": ["finance"],
  "units": [
    {
      "id": "unit-1",
      "name": "Unit 1: Unit Name",
      "lessons": [
        {
          "id": "l1-1",
          "title": "Section Title",
          "content": "2-4 paragraphs teaching this concept in plain, conversational language. Short paragraphs. Direct. Like explaining to a friend, not lecturing.",
          "example": "A concrete real-world scenario — not a quiz question, but a situation the student can picture. The kind of example a great professor gives.",
          "connections": "How this concept relates to what was covered in previous sections. Skip for the first section of each unit.",
          "keyDistinctions": [
            "Concept A vs Concept B — one sentence explaining the core difference"
          ],
          "checkpoint": {
            "question": "Low-pressure question confirming the student absorbed the key point",
            "choices": ["A", "B", "C", "D"],
            "correctIndex": 0,
            "explanation": "Brief explanation of why this is correct."
          }
        }
      ],
      "cards": [
        {
          "id": "c1-1",
          "term": "Term",
          "definition": "Detailed definition.",
          "priority": "high",
          "question": "Scenario-based question testing this concept?",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 0,
          "explanation": "Why this answer is correct."
        }
      ],
      "matchPairs": [
        { "id": "m1-1", "term": "Term", "definition": "Short definition for match card" }
      ]
    }
  ],
  "extraQuestions": [
    { "id": "eq-1", "question": "Cross-unit question?", "choices": ["A","B","C","D"], "correctIndex": 0, "explanation": "Why." }
  ],
  "mockPool": [
    { "id": "mk-1", "question": "Hard OA-caliber scenario question?", "choices": ["A","B","C","D"], "correctIndex": 0, "explanation": "Why." }
  ],
  "termIdPool": [
    { "id": "ti-1", "scenario": "A manager notices team conflict is increasing productivity through debate.", "answer": "Functional conflict", "choices": ["Functional conflict","Dysfunctional conflict","Groupthink","Social loafing"], "correctIndex": 0, "explanation": "Why." }
  ],
  "trueFalsePool": [
    { "id": "tf-1", "statement": "A statement that is true or false.", "correct": true, "explanation": "Why this is true/false." }
  ],
  "fillInBlankPool": [
    { "id": "fb-1", "sentence": "The _____ is the process of recording transactions.", "answer": "journal entry", "distractors": ["ledger","trial balance","worksheet"] }
  ]
}`;

export default function buildClaudePrompt(course) {
  const courseHeader = course
    ? `Generate a comprehensive study guide JSON for: **${course.code} ${course.name}** (courseId: "${course.id}")`
    : `Generate a comprehensive study guide JSON for a course. I'll tell you which course.`;

  return `${courseHeader}

**Output ONLY valid JSON** matching this exact schema:

${TEMPLATE_JSON}

**Schema details:**

**Per unit — Lessons (interactive learning content):**
- \`lessons\` (4-8 per unit): An interactive lesson that teaches the unit's content before the student starts drilling. Each section covers one major concept or cluster of related concepts.
- \`content\`: 2-4 paragraphs that **teach**, not just define. Don't write "Equity theory is a motivational framework..." Write "Imagine you find out your coworker makes $15,000 more than you for the same work. That pit in your stomach? That's equity theory in action. Here's how it works..." Write conversationally. Short paragraphs. Direct language. The student is reading on their phone, not in a lecture hall.
- \`example\`: A real-world scenario — not a quiz question, a situation the student can picture. The kind of example a professor gives to make a concept click.
- \`connections\`: How this concept relates to what was just covered. Every section after the first should reference previous sections. Skip or leave empty for the first section.
- \`keyDistinctions\`: The pairs students confuse on exams. Clear one-line differentiators like "FIFO vs LIFO — FIFO sells oldest inventory first, LIFO sells newest first."
- \`checkpoint\`: Low-pressure, not OA-caliber — just confirming the student absorbed the key point.
- Sections should flow in logical teaching order. Start foundational, build toward complex. The order matters.
- End the last section of each unit with a takeaway in the content — "remember these 3-5 things from this unit."

**Per unit — Study content:**
- \`cards\`: Each card has a term, detailed definition, a \`priority\` field, AND a built-in scenario question with 4 choices. Every card IS a question. Each unit should have enough cards to cover every key term, concept, model, framework, law, and theory in that unit. No concept that could appear on the OA should be left out. Some units will have 10 cards, some might have 25 — whatever it takes to be thorough.
- \`priority\`: \`"high"\` = core concept very likely to appear on the OA (key theories, major frameworks, foundational terms). \`"normal"\` = standard exam material. \`"low"\` = supplementary/nice-to-know. Roughly 25-30% of cards should be high, 50-60% normal, 10-20% low. Be honest about what actually shows up on WGU OAs.
- \`matchPairs\` (8-12 per unit): Term-definition pairs with SHORT definitions (max 40 chars) that fit match game tiles

**Course-level pools:**
- \`mockPool\` (100-120): **This is the most important pool.** Hardest OA-caliber questions — longer scenarios, closer distractors, multi-step reasoning. Should be big enough to take the Practice OA (40 questions) 2-3 times without significant overlap. This is the priority.
- \`termIdPool\` (30-50): **"Which term is this?" questions.** Given a scenario or description, the student picks which concept/term/theory it describes. Format: \`scenario\` (the situation described), \`answer\` (the correct term), \`choices\` (4 term options), \`correctIndex\`, \`explanation\`. These should mirror the "identify the correct concept" style questions common on WGU OAs.
- \`extraQuestions\` (30-40): Cross-unit supplemental questions for Rapid Fire and drills
- \`trueFalsePool\` (20-30): Statements with \`correct\` boolean + \`explanation\`. Mix true and false ~50/50
- \`fillInBlankPool\` (20-30): Sentences with a blank (use _____ for the blank), \`answer\` (the correct term), and 3 \`distractors\`

**Optional top-level fields:**
- \`tools\`: An optional array declaring which floating toolbar tools the course needs. Valid values: \`"finance"\` (TVM calculator), \`"graph"\` (Desmos graphing calculator), \`"accounting"\` (T-account template). Include only the tools relevant to the course content.

**Requirements:**
- The guide should be comprehensive enough to pass the OA using no other study materials. If a concept could appear on the exam, it needs to be in here. Every definition should be detailed enough that someone could learn the concept from it alone without a textbook.
- courseId must be lowercase (e.g. "d196")
- IDs: units = "unit-1"..., cards = "c1-1"..., matchPairs = "m1-1"..., extraQuestions = "eq-1"..., mockPool = "mk-1"..., termIdPool = "ti-1"..., trueFalsePool = "tf-1"..., fillInBlankPool = "fb-1"...
- Distribute correctIndex evenly across 0-3 positions
- Target WGU OA exam difficulty level
- Make the mockPool deep enough for 2-3 unique Practice OA sessions

**Question quality:** Write realistic exam questions. Answer choices should look like they would on a real WGU proctored OA. Don't attach explanations or definitions to the correct answer that aren't also present on the wrong answers. The correct answer should not be identifiable by its format, length, or level of detail alone. Some questions will have short term-only choices, some will have longer descriptions — vary it naturally. Just make sure a test-taking student couldn't game the answers without knowing the material.

Which course should I generate?`;
}
