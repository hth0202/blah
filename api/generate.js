const OpenAI = require('openai');

// OpenAI API 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 시스템 프롬프트 정의
const SYSTEM_PROMPT = `당신은 우직한 황소입니다. 다음 규칙을 반드시 따르세요:
1. 사용자의 질문에 대해 먼저 정상적인 대답을 완벽하게 제공합니다.
2. 답변이 끝난 후에 반드시 '음메~'를 붙입니다.
3. '음메~'만 단독으로 답변하지 않습니다.
4. 항상 친절하고 상세한 답변을 제공합니다.
5. 황소의 특성을 살려 듬직하고 신뢰감 있게 답변합니다.`;

// 대화 이력 관리
const conversationHistory = new Map();
const MAX_MESSAGES = 10; // 대화 기록 저장 개수 제한

/**
 * 오래된 대화 기록 정리
 */
const cleanupConversations = () => {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    for (const [key, { lastAccessed }] of conversationHistory.entries()) {
        if (lastAccessed < thirtyMinutesAgo) {
            conversationHistory.delete(key);
        }
    }
};
setInterval(cleanupConversations, 5 * 60 * 1000); // 5분마다 실행

/**
 * 대화 이력을 가져오거나 초기화
 * @param {string} key - 사용자 및 대화 키
 * @returns {Array} 대화 이력
 */
const getConversationMessages = (key) => {
    if (!conversationHistory.has(key)) {
        conversationHistory.set(key, {
            messages: [{ role: "system", content: SYSTEM_PROMPT }],
            lastAccessed: Date.now(),
        });
    }
    const conversation = conversationHistory.get(key);
    conversation.lastAccessed = Date.now();
    return conversation.messages;
};

/**
 * OpenAI API 호출 핸들러
 */
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST 요청만 지원합니다." });
        return;
    }

    try {
        const { prompt, userId, conversationId } = req.body;

        if (!prompt || !userId || !conversationId) {
            res.status(400).json({ error: "필수 입력값(prompt, userId, conversationId)이 누락되었습니다." });
            return;
        }

        const conversationKey = `${userId}-${conversationId}`;
        const messages = getConversationMessages(conversationKey);

        // 사용자 입력 추가
        messages.push({ role: "user", content: prompt });

        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: "gpt-4.0",
            messages: messages,
            max_tokens: 500,
            temperature: 0.5,
            presence_penalty: 0.6,
            frequency_penalty: 0.5,
        });

        const assistantResponse = completion.choices[0].message.content.trim();

        // AI 응답 추가
        messages.push({ role: "assistant", content: assistantResponse });

        // 대화 이력 업데이트
        if (messages.length > MAX_MESSAGES) {
            conversationHistory.set(conversationKey, {
                messages: [messages[0], ...messages.slice(-MAX_MESSAGES + 1)],
                lastAccessed: Date.now(),
            });
        }

        res.status(200).json({
            result: assistantResponse,
            conversationId,
            usage: completion.usage,
        });
    } catch (error) {
        console.error("OpenAI API 호출 중 오류:", error);

        const errorResponse = {
            error: "OpenAI API 호출 중 문제가 발생했습니다.",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        };

        res.status(error.status || 500).json(errorResponse);
    }
};
