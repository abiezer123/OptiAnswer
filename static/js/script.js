const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

const API_URL = "/chat"; // Updated to match Flask API route
const systemMessage = {
    role: "system",
    content: "Ikaw ay isang kaibigan na handang makinig at magbigay ng suporta. Huwag magbigay ng inpormasyon na hindi kaugnay sa mental health. Maging magiliw at sumagot lamang sa Tagalog. Magbigay ng payo kung nararamdaman mong kailangan ko ito bilang kausap."
};

let conversationHistory = [];

function typeEffect(text, sender, callback) {
    let index = 0;
    const typingSpeed = 50;

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("chat-message");

    if (sender === "bot") {
        const botMsgContainer = document.createElement("div");
        botMsgContainer.classList.add("bot-msg-container");

        const logoImg = document.createElement("img");
        logoImg.src = "/static/images/logo.png";
        logoImg.alt = "Bot Logo";
        logoImg.classList.add("bot-logo");

        const botMsgBubble = document.createElement("div");
        botMsgBubble.classList.add("bot-msg");
        botMsgBubble.innerText = "";

        botMsgContainer.appendChild(logoImg);
        botMsgContainer.appendChild(botMsgBubble);
        messageDiv.appendChild(botMsgContainer);
    } else {
        messageDiv.classList.add("user-msg");
        messageDiv.innerText = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (sender === "bot") {
        const botMsgBubble = messageDiv.querySelector(".bot-msg");
        const typingInterval = setInterval(() => {
            botMsgBubble.innerText += text.charAt(index);
            index++;
            chatBox.scrollTop = chatBox.scrollHeight;
            if (index === text.length) {
                clearInterval(typingInterval);
                callback();
            }
        }, typingSpeed);
    }
}

async function getBotResponse(userMessage) {
    conversationHistory.push({ role: "user", content: userMessage });

    // Keep only the last 4 messages
    if (conversationHistory.length > 4) {
        conversationHistory = conversationHistory.slice(-4);
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: userMessage
            })
        });

        const data = await response.json();

        if (data && data.reply) {
            const botReply = data.reply.trim();
            conversationHistory.push({ role: "assistant", content: botReply });
            return botReply;
        } else {
            return "Nandito ako para makinig. Ano ang nasa isip mo ngayon?";
        }
    } catch (error) {
        console.error("Error during API request:", error);
        return "Pasensya na, hindi kita naintindihan. Pwede mo bang ulitin?";
    }
}

function addMessage(content, sender) {
    const messageDiv = document.createElement("div");

    if (sender === "bot") {
        const botMsgContainer = document.createElement("div");
        botMsgContainer.classList.add("bot-msg-container");

        const logoImg = document.createElement("img");
        logoImg.src = "/static/images/logo.png";
        logoImg.alt = "Bot Logo";
        logoImg.classList.add("bot-logo");

        const botMsgBubble = document.createElement("div");
        botMsgBubble.classList.add("bot-msg");
        botMsgBubble.textContent = content;

        botMsgContainer.appendChild(logoImg);
        botMsgContainer.appendChild(botMsgBubble);
        messageDiv.appendChild(botMsgContainer);
    } else {
        messageDiv.classList.add("chat-message", "user-msg");
        messageDiv.innerText = content;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
    const userMessage = userInput.value.trim();

    if (userMessage) {
        addMessage(userMessage, "user");
        userInput.value = "";

        const botMessage = await getBotResponse(userMessage);

        typeEffect(botMessage, "bot", () => {
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        // Debug: Check if request is being sent
        console.log("Sending chat to /save_chat:", { message: userMessage, reply: botMessage });

        // Save chat to MongoDB
        fetch("/save_chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: userMessage, reply: botMessage })
        }).then(response => response.json())
          .then(data => console.log("Save chat response:", data))
          .catch(error => console.error("Error saving chat:", error));
    }
});


userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && userInput.value.trim()) {
        sendBtn.click();
    }
});

window.onload = () => {
    // Retrieve email and username from session
    const userEmail = sessionStorage.getItem("userEmail");  // Assuming you store email in sessionStorage
    const username = sessionStorage.getItem("userName");  // Assuming you store username in sessionStorage

    // Greet the user
    if (username) {
        addMessage(`Kumusta, ${username}? Nandito ako para makinig at suportahan ka. 💙`, "bot");
    } else {
        addMessage("Kumusta? Nandito ako para makinig at suportahan ka. 💙", "bot");
    }

    // Load history chats based on the user email
    fetch(`/history?email=${userEmail}`)
        .then(response => response.json())
        .then(data => {
            const historyBox = document.getElementById("history-box");
            if (!historyBox) return;

            data.history.forEach(chat => {
                const chatDiv = document.createElement("div");
                chatDiv.classList.add("history-item");
                chatDiv.innerHTML = `<p><strong>You:</strong> ${chat.user}</p>
                                     <p><strong>Bot:</strong> ${chat.bot}</p>`;
                historyBox.appendChild(chatDiv);
            });
        });
};

