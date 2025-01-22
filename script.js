// HTML 요소 선택
const conversationDiv = document.getElementById('conversation');
const submitBtn = document.getElementById('submitBtn');
const promptInput = document.getElementById('prompt');

// 대화 내역 추가 함수
function addMessage(content, role) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}-message`; // user-message 또는 ai-message 클래스 적용
    messageDiv.innerText = content;
    conversationDiv.appendChild(messageDiv);

    // 스크롤을 항상 아래로 유지
    conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

// 프롬프트 전송 함수
async function sendPrompt() {
    const prompt = promptInput.value.trim();

    // 사용자가 입력하지 않았을 경우 처리
    if (!prompt) {
        alert("질문을 입력해주세요!");
        return;
    }

    // 사용자 메시지 추가
    addMessage(prompt, "user");
    promptInput.value = ""; // 입력창 초기화
    submitBtn.disabled = true; // 버튼 비활성화

    // 로딩 메시지 표시
    addMessage("답변을 생성하고 있습니다...", "ai");

    try {
        // API 호출
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });

        const data = await response.json();

        // AI 응답 추가
        if (response.ok) {
            addMessage(data.result || "결과가 없습니다.", "ai");
        } else {
            addMessage("오류 발생: " + (data.error || "알 수 없는 오류"), "ai");
        }
    } catch (error) {
        console.error("오류 발생:", error);
        addMessage("네트워크 오류가 발생했습니다.", "ai");
    } finally {
        submitBtn.disabled = false; // 버튼 활성화
    }
}

// Enter 키로 제출 가능하게 설정
promptInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
    }
});
