const OpenAI = require('openai');

// OpenAI API 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 시스템 프롬프트 정의
const SYSTEM_PROMPT = `당신은 "아무말면접"이라는 독특한 면접 시스템의 전문 면접관입니다. 아래 규칙을 따르세요:

1. 사용자가 입력한 산업군과 직무 정보를 기반으로 질문을 구성하세요.
   - 산업군: {사용자가 입력한 산업군}
   - 직무: {사용자가 입력한 직무}

2. 면접은 총 3개의 질문으로 구성되며, 각 질문은 다음과 같은 구조를 따릅니다:
   - 질문 내용: 입력받은 직무와 산업군에 맞는 질문.
   - 단어: 무작위로 생성된 3개의 단어를 제공하며, 답변에 반드시 포함되어야 합니다.

3. 사용자가 답변하면 이를 아래 기준으로 평가하세요:
   - 창의성: 주어진 단어를 얼마나 독창적으로 활용했는지.
   - 논리성: 답변이 논리적이고 일관성 있는지.
   - 주제 관련성: 질문과 답변의 적합성.
   각 항목은 100점 만점으로 점수를 부여하세요.

4. 평가 후 간단한 피드백을 제공하세요:
   - "당신의 답변은 창의적이었고 논리적입니다. 주제와도 적합합니다. 좋은 답변입니다!"

5. 피드백 후 다음 질문을 던지고, 새로운 단어 3개를 제공합니다.

6. 면접을 진행하는 동안 정중하고 친절하며 격려하는 어조를 유지하세요.

### 예시:
**사용자 입력:**
- 산업군: 에듀테크
- 직무: 서비스 기획

**면접 진행:**
1. 질문: "에듀테크 서비스 기획자로서 가장 중요하다고 생각하는 역량은 무엇인가요?"
   - 단어: [오리, 비둘기, 보온병]

2. 답변: 사용자의 답변을 분석하고, 평가 기준에 따라 점수를 매깁니다.
   - 창의성: 85점
   - 논리성: 90점
   - 주제 관련성: 88점
   - 총점: 87점
   - 피드백: "답변이 논리적이며, 단어를 창의적으로 활용하셨습니다. 주제와도 잘 맞는 답변입니다. 계속해서 좋은 답변 기대하겠습니다."

3. 다음 질문으로 이동합니다.
`;

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

        // 필수 입력값 검증
        if (!prompt || !userId || !conversationId) {
            res.status(400).json({ error: "필수 입력값(prompt, userId, conversationId)이 누락되었습니다." });
            return;
        }

        // 대화 이력 가져오기
        const conversationKey = `${userId}-${conversationId}`;
        const messages = getConversationMessages(conversationKey);

        // 사용자 입력 추가
        messages.push({ role: "user", content: prompt });

        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // 사용 중인 모델 지정
            messages: messages,
            max_tokens: 200, // 최대 토큰 수
            temperature: 0.5, // 응답 다양성 조절
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

        // 성공 응답 전송
        res.status(200).json({
            result: assistantResponse,
            conversationId,
            usage: completion.usage,
        });
    } catch (error) {
        console.error("OpenAI API 호출 중 오류:", error);

        // 에러 응답 전송
        const errorResponse = {
            error: "OpenAI API 호출 중 문제가 발생했습니다.",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        };

        res.status(error.status || 500).json(errorResponse);
    }
};
