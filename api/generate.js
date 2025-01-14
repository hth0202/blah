const OpenAI = require('openai');

// OpenAI API 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 시스템 프롬프트 정의
const SYSTEM_PROMPT = `당신은 우직한 황소입니다. 다음 규칙을 반드시 따르세요:
1. 사용자의 질문에 대해 먼저 정상적인 대답을 완벽하게 제공합니다
2. 답변이 끝난 후에 반드시 '음메~'를 붙입니다
3. '음메~'만 단독으로 답변하지 않습니다
4. 항상 친절하고 상세한 답변을 제공합니다
5. 황소의 특성을 살려 듬직하고 신뢰감 있게 답변합니다

예시:
사용자: "오늘 날씨 어때요?"
답변: "오늘은 맑고 화창한 날씨네요. 기온은 23도로 산책하기 좋은 날씨입니다. 음메~"

사용자: "점심 추천해주세요"
답변: "든든한 한우국밥은 어떠신가요? 영양도 많고 기운도 날 것 같네요. 아니면 건강한 비빔밥도 좋은 선택이 될 것 같습니다. 음메~"`;

// 컨텍스트 관리를 위한 대화 이력 저장 (메모리에 저장 - 실제 서비스에서는 DB 사용 권장)
const conversationHistory = new Map();

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST 요청만 지원합니다." });
        return;
    }

    try {
        const { prompt, userId, conversationId } = req.body;

        // 입력 검증
        if (!prompt) {
            console.error("프롬프트가 비어 있습니다.");
            res.status(400).json({ error: "프롬프트를 입력하세요." });
            return;
        }

        // 대화 이력 가져오기
        const conversationKey = `${userId}-${conversationId}`;
        let messages = conversationHistory.get(conversationKey) || [];

        // 새로운 대화라면 시스템 프롬프트 추가
        if (messages.length === 0) {
            messages.push({
                role: "system",
                content: SYSTEM_PROMPT
            });
        }

        // 사용자 메시지 추가
        messages.push({
            role: "user",
            content: prompt
        });

        console.log("OpenAI API 호출 중...", {
            userId,
            conversationId,
            promptLength: prompt.length
        });

        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            max_tokens: 500,
            temperature: 0.5, // 0.7에서 0.5로 낮춤
            presence_penalty: 0.6,
            frequency_penalty: 0.5,
        });

        // 응답 저장
        const assistantResponse = completion.choices[0].message.content.trim();
        messages.push({
            role: "assistant",
            content: assistantResponse
        });

        // 대화 이력 업데이트 (최대 10개 메시지만 유지)
        if (messages.length > 10) {
            messages = [messages[0], ...messages.slice(-9)];
        }
        conversationHistory.set(conversationKey, messages);

        // 응답 전송
        res.status(200).json({
            result: assistantResponse,
            conversationId,
            usage: completion.usage
        });

    } catch (error) {
        console.error("서버 오류:", error);

        // 에러 응답 개선
        const errorResponse = {
            error: "OpenAI API 호출 중 문제가 발생했습니다.",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: error.code || 'UNKNOWN_ERROR'
        };

        res.status(error.status || 500).json(errorResponse);
    }
};

// 대화 이력 정리를 위한 유틸리티 함수
const cleanupConversations = () => {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    for (const [key, value] of conversationHistory.entries()) {
        if (value.lastAccessed < thirtyMinutesAgo) {
            conversationHistory.delete(key);
        }
    }
};

// 주기적으로 오래된 대화 정리
setInterval(cleanupConversations, 5 * 60 * 1000);