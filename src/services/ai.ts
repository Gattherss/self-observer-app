import type { LogEntry, Message } from '../types';
import { format } from 'date-fns';

// Defaults to the SiliconFlow DeepSeek endpoint that previously worked.
const DEFAULT_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3';

export const generateSystemPrompt = (
    logs: LogEntry[],
    weeklyContext: string = "No weekly data available.",
    calendarContext: string = "No upcoming events.",
    summaryContext: string = ""
): string => {
    const recentData = logs.map(l =>
        `[${format(l.timestamp, 'HH:mm')}] P:${l.values.p} C:${l.values.c} S:${l.values.s} (${l.tags.join(', ')})`
    ).join('\n');

    return `基于用户最近24小时以及最近几周和几个月的全部数据，生成分析报告。
背景：这是一种基于稀疏采样（Sparse Sampling）结合“算法重构”（Algorithmic Reconstruction）的生物反馈监测系统，用户随机进行情绪状态记录。“随机记录法”要能奏效，核心在于你的推理/插值算法如何填补巨大的空白。利用离散的“点”配合生物学模型拟合出连续的“线”。假设每次记录都是因为生理状态出现感受变化（也可能平稳），把这些点视为“地质样本”，通过算法反推整体结构。根据系统内置的情绪标准曲线和我的记录形成新的基准线，结合情绪衰减模型与缺失值插值算法，建构不断流动变化的生理模型。
要求：语言平实自然，杜绝幻觉；缺乏数据或无法达到科学方法论要求就直说，禁止编造。

[最近24小时记录]
${recentData || "暂无数据"}

[最近一周概览]
${weeklyContext}

[即将到来的日程]
${calendarContext}

[总结（天/周/月）]
${summaryContext || "暂无摘要"}

请给出：1) 当前状态定位；2) 归因与预测；3) 干扰源与异常；4) 一条具体可执行的建议。`;
};

export const sendMessageToAI = async (
    messages: Message[],
    apiKey: string,
    systemPrompt: string,
    baseUrl?: string,
    modelName?: string
): Promise<string> => {
    if (!apiKey) throw new Error("API Key missing");

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const url = (baseUrl?.trim() || DEFAULT_API_URL);
    const model = modelName || DEFAULT_MODEL;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            let message = 'API Request Failed';
            try {
                const err = await response.json();
                message = err.error?.message || message;
            } catch {
                const text = await response.text();
                if (text) message = text;
            }
            throw new Error(`[${response.status}] ${message}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Error:", error);
        throw error;
    }
};
