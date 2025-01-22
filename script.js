const infoForm = document.getElementById("infoForm");
const industryInput = document.getElementById("industry");
const roleInput = document.getElementById("role");
const startBtn = document.getElementById("startBtn");

const serviceDescription = document.getElementById("serviceDescription");
const conversationContainer = document.getElementById("conversationContainer");
const conversationDiv = document.getElementById("conversation");
const promptInput = document.getElementById("prompt");
const submitBtn = document.getElementById("submitBtn");

let conversationId = "test-session"; // 예제 세션 ID
let userId = "guest-user"; // 사용자 ID
let industry = "";
let role = "";

// 메시지 추가 함수
function addMessage(content, role) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}-message`; // user-message 또는 ai-message 클래스 적용
    messageDiv.innerText = content;
    conversationDiv.appendChild(messageDiv);

    // 스크롤을 항상 아래로 유지
    conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

// 면접 시작 함수
async function startConversation() {
    industry = industryInput.value.trim();
    role = roleInput.value.trim();

    // 입력값 확인
    if (!industry || !role) {
        alert("산업군과 직무를 모두 입력해주세요.");
        return;
    }

    // UI 전환
    infoForm.style.display = "none";
    serviceDescription.style.display = "block";
    conversationContainer.style.display = "block";

    // 초기 대화 시작: 산업군과 직무 정보를 백엔드로 전달
    const initialPrompt = `사용자는 [${industry}] 산업의 [${role}] 직무를 지원합니다. 이에 맞춰 면접을 진행해주세요.`;
    addMessage(initialPrompt, "user");

    // AI 응답 요청
    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: initialPrompt, userId, conversationId }),
        });

        const data = await response.json();
        if (response.ok) {
            addMessage(data.result || "결과가 없습니다.", "ai");
        } else {
            addMessage("오류 발생: " + (data.error || "알 수 없는 오류"), "ai");
        }
    } catch (error) {
        console.error("오류 발생:", error);
        addMessage("네트워크 오류가 발생했습니다.", "ai");
    }
}

// 대화 전송 함수
async function sendPrompt() {
    const prompt = promptInput.value.trim();

    // 입력값 확인
    if (!prompt) {
        alert("질문을 입력해주세요!");
        return;
    }

    addMessage(prompt, "user");
    promptInput.value = "";
    submitBtn.disabled = true;

    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, userId, conversationId }),
        });

        const data = await response.json();
        if (response.ok) {
            addMessage(data.result || "결과가 없습니다.", "ai");
        } else {
            addMessage("오류 발생: " + (data.error || "알 수 없는 오류"), "ai");
        }
    } catch (error) {
        console.error("오류 발생:", error);
        addMessage("네트워크 오류가 발생했습니다.", "ai");
    } finally {
        submitBtn.disabled = false;
    }
}

// 이벤트 리스너
startBtn.addEventListener("click", startConversation);
submitBtn.addEventListener("click", sendPrompt);

promptInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
    }
});
