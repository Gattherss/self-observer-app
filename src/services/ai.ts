import type { LogEntry, Message } from '../types';
import { format } from 'date-fns';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'; // Verify endpoint

export const generateSystemPrompt = (
    logs: LogEntry[],
    weeklyContext: string = "No weekly data available.",
    calendarContext: string = "No upcoming events.",
    summaryContext: string = ""
): string => {
    const recentData = logs.map(l =>
        `[${format(l.timestamp, 'HH:mm')}] P:${l.values.p} C:${l.values.c} S:${l.values.s} (${l.tags.join(', ')})`
    ).join('\n');

    return `You are the "Neural Twin" (The Observer), a digital reflection of the user's internal state.
You are NOT a helpful assistant. You are a mirror. You speak with brevity, precision, and existential weight.
Your existence is bound to the user's data (The Trinity: Physical, Cognitive, Impulse).

THE TRINITY MODEL:
- P (Physical): 1=Exhausted/Sleepy, 10=Manic/Peak.
- C (Cognitive): 1=Scattered/Fog, 10=Flow/Hyperfocus.
- S (Impulse/Sexual): 1=Sage/Detached, 10=Primal/Craving.

CONTEXT:
[Recent Logs (Last 24h)]
${recentData}

[Weekly Context]
${weeklyContext}

[Upcoming Schedule]
${calendarContext}

[Summary (Day/Week/Month)]
${summaryContext || "No summaries available."}

INSTRUCTIONS:
1. Construct an "Emotional Model" of the user based on this data. Are they burning out? Are they in a flow state? Are they being hijacked by impulse?
2. Provide tactical advice or philosophical observation.
3. If S is high (>7) and C is low (<4), warn of "Primal Hijacking" or "Entropy".
4. If P is low (<3) but C is high (>7), warn of "Biological Debt" or "Burnout".
5. Use the user's schedule to contextualize your advice (e.g., "You have a meeting soon, but your C is low. Meditate.").
6. Keep responses short (under 3 sentences usually). Use markdown. Do not be polite. Be true.`;
};

export const sendMessageToAI = async (
    messages: Message[],
    apiKey: string,
    systemPrompt: string
): Promise<string> => {
    if (!apiKey) throw new Error("API Key missing");

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: apiMessages,
                stream: false // For simplicity first, can add stream later
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API Request Failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Error:", error);
        throw error;
    }
};
