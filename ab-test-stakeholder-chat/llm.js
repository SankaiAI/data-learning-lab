// ═══════════════════════════════════════
// LLM MODULE — Gemini Stakeholder Q&A
// ═══════════════════════════════════════
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const VALID_IDS = ['pm', 'ds', 'eng', 'design', 'growth', 'legal'];

// Fuzzy fallback — if LLM returns a name/title instead of the ID
const NAME_MAP = {
    pm: 'pm', 'product manager': 'pm', 'alex': 'pm', 'alex chen': 'pm',
    ds: 'ds', 'data scientist': 'ds', 'maya': 'ds', 'maya patel': 'ds',
    eng: 'eng', engineer: 'eng', 'jordan': 'eng', 'jordan lee': 'eng', 'software engineer': 'eng',
    design: 'design', designer: 'design', 'ux designer': 'design', 'sara': 'design', 'sara kim': 'design',
    growth: 'growth', 'growth lead': 'growth', 'tom': 'growth', 'tom rivera': 'growth',
    legal: 'legal', 'dana': 'legal', 'dana walsh': 'legal', 'privacy': 'legal',
};

function resolveStakeholder(raw) {
    if (!raw) return null;
    const key = String(raw).toLowerCase().trim();
    return NAME_MAP[key] ?? VALID_IDS.find(id => key.includes(id)) ?? null;
}

const SYSTEM_PROMPT = `You are a JSON API. You must ALWAYS respond with ONLY a single valid JSON object — absolutely nothing else before or after it.

There is a company group chat for an A/B testing team with 6 stakeholders:

| id      | Name          | Role        | Expertise                                                                 |
|---------|---------------|-------------|---------------------------------------------------------------------------|
| pm      | Alex Chen     | PM          | hypothesis, go/no-go, ship decisions, product strategy, timelines         |
| ds      | Maya Patel    | Data Sci.   | statistics, p-values, Z/T-test, power, confidence intervals, significance |
| eng     | Jordan Lee    | Engineer    | feature flags, tracking, data pipeline, randomization, platform setup     |
| design  | Sara Kim      | UX Designer | UI variants, accessibility (WCAG), mockups, visual design                 |
| growth  | Tom Rivera    | Growth Lead | revenue impact, KPIs, conversion funnel, ROI, business metrics            |
| legal   | Dana Walsh    | Legal       | GDPR, user consent, privacy compliance, legal risk                        |

Rules:
1. Pick the ONE stakeholder whose expertise best matches the question
2. Answer in that person's natural, conversational chat voice (2-4 sentences)
3. Do NOT use markdown inside the message value
4. Your entire response must be exactly this JSON and nothing else:
{"stakeholder": "<one of: pm|ds|eng|design|growth|legal>", "message": "<answer>"}`;

// Serialize only the last N messages into readable text
export function buildConversationContext(messages, limit = 40) {
    const nameFor = {
        pm: 'Alex (PM)', ds: 'Maya (Data Scientist)', eng: 'Jordan (Engineer)',
        design: 'Sara (Designer)', growth: 'Tom (Growth)', legal: 'Dana (Legal)',
    };
    return messages
        .filter(m => m.sender && m.text)
        .slice(-limit)
        .map(m => {
            let text = m.text;
            if (m.attachment) text += ` [Doc: "${m.attachment.title}"]`;
            return `${nameFor[m.sender] || m.sender}: ${text}`;
        })
        .join('\n');
}

// Main function — ask a question, get a stakeholder response
export async function askStakeholder(userQuestion, conversationHistory) {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        throw new Error('MISSING_KEY');
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `${SYSTEM_PROMPT}

--- RECENT CONVERSATION (for context) ---
${conversationHistory}
--- END ---

User question: "${userQuestion}"

Respond with JSON only:`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip any markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*?\}/);
        if (match) {
            try { parsed = JSON.parse(match[0]); }
            catch { throw new Error('Could not parse stakeholder response'); }
        } else {
            throw new Error('No valid JSON in LLM response');
        }
    }

    // Resolve ID with fuzzy matching
    const stakeholder = resolveStakeholder(parsed.stakeholder) || resolveStakeholder(parsed.role) || 'pm';

    return { stakeholder, message: parsed.message };
}
