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
    if (!text) {
        console.error("Error: 'text' is undefined or null.");
        return;
    }

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

async function getBotResponse(message) {
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: message }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json(); // Read the response body only once
            const botReply = data.reply; // Use the 'reply' property from the response
            return botReply; // Return the bot reply for further use
        } else {
            console.error("Error during API request:", response.statusText);
        }
    } catch (error) {
        console.error("Error during API request:", error);
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

// Modify addMessageForHistory to apply the same design as addMessage
function addMessageForHistory(content, role) {
    const messageElement = document.createElement("div");

    if (role === "user") {
        messageElement.classList.add("user-msg");  // Use the same class as user messages
        messageElement.innerText = content;
    } else if (role === "bot") {
        const botMsgContainer = document.createElement("div");
        botMsgContainer.classList.add("bot-msg-container");

        const logoImg = document.createElement("img");
        logoImg.src = "/static/images/logo.png";
        logoImg.alt = "Bot Logo";
        logoImg.classList.add("bot-logo");

        const botMsgBubble = document.createElement("div");
        botMsgBubble.classList.add("bot-msg");
        botMsgBubble.innerText = content;

        botMsgContainer.appendChild(logoImg);
        botMsgContainer.appendChild(botMsgBubble);
        messageElement.appendChild(botMsgContainer);
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}


sendBtn.addEventListener("click", async () => {
    const userMessage = userInput.value.trim();

    if (userMessage) {
        addMessage(userMessage, "user");
        userInput.value = "";

        const botMessage = await getBotResponse(userMessage);

        // Ensure botMessage is not undefined before passing to typeEffect
        if (botMessage) {
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
        } else {
            console.error("Bot response is undefined.");
        }
    }
});


userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && userInput.value.trim()) {
        sendBtn.click();
    }
});

// Load session + history
window.onload = async () => {
    try {
        const response = await fetch("/get_session_data");
        const data = await response.json();

        const userEmail = data.user_email;
        const username = data.username;
        let sessionId = data.session_id || localStorage.getItem("sessionId");

        if (!sessionId) {
            sessionId = crypto.randomUUID();
            localStorage.setItem("sessionId", sessionId);
        }

        console.log("Username:", username);
        console.log("User Email:", userEmail);
        console.log("Session ID:", sessionId);

        if (username) {
            addMessage(`Kumusta, ${username}? Nandito ako para makinig at suportahan ka. 💙`, "bot");
        } else {
            addMessage("Kumusta? Nandito ako para makinig at suportahan ka. 💙", "bot");
        }

        if (!userEmail || !sessionId) {
            console.error("No user session found.");
            return;
        }

        const historyResponse = await fetch(`/history?email=${userEmail}&session_id=${sessionId}`);
        const historyData = await historyResponse.json();

        const historyBox = document.getElementById("history-box");
        if (!historyBox) return;

        // Display chat history if available
        if (historyData.history && historyData.history.length > 0) {
            historyData.history.forEach(historyItem => {
                const chatDiv = document.createElement("div");
                chatDiv.classList.add("history-item");

                // Add bot message
                const botMessageDiv = document.createElement("div");
                botMessageDiv.classList.add("bot-history");
                botMessageDiv.innerHTML = `<strong>Bot:</strong> ${historyItem.bot}`;

                chatDiv.appendChild(botMessageDiv);

                // Add user message if available
                if (historyItem.user) {
                    const userMessageDiv = document.createElement("div");
                    userMessageDiv.classList.add("user-history");
                    userMessageDiv.innerHTML = `<strong>User:</strong> ${historyItem.user}`;
                    chatDiv.appendChild(userMessageDiv);
                }

                // Add an event listener to load the full conversation when clicked
                chatDiv.addEventListener("click", () => {
                    chatBox.innerHTML = "";

                    // Add history messages when a history item is clicked
                    if (historyItem.messages) {
                        historyItem.messages.forEach(message => {
                            addMessageForHistory(message.content, message.role);
                        });
                    }

                    chatBox.scrollTop = chatBox.scrollHeight;
                });

                historyBox.appendChild(chatDiv);
            });
        } else {
            historyBox.innerHTML = "<p>No history available.</p>";
        }

    } catch (error) {
        console.error("Error loading session or history:", error);
    }
};
