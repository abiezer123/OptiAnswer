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
        botMsgBubble.innerText = "";  // Start with an empty text for bot message

        botMsgContainer.appendChild(logoImg);
        botMsgContainer.appendChild(botMsgBubble);
        messageDiv.appendChild(botMsgContainer);
    } else {
        messageDiv.classList.add("user-msg");
        messageDiv.innerText = text;
    }

    chatBox.appendChild(messageDiv);

    // Scroll to the bottom during typing if the sender is 'bot'
    if (sender === "bot") {
        let isUserScrolling = chatBox.scrollTop !== chatBox.scrollHeight - chatBox.clientHeight;
        // Keep track of whether the user is already manually scrolling
        chatBox.scrollTop = chatBox.scrollHeight;  // Scroll to bottom during typing

        const botMsgBubble = messageDiv.querySelector(".bot-msg");
        const typingInterval = setInterval(() => {
            botMsgBubble.innerText += text.charAt(index);  // Add one character at a time
            index++;

        
            if (index === text.length) {
                clearInterval(typingInterval);
                callback();  // After typing is complete, call the callback
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
        // User message
        messageElement.classList.add("user-msg");  // Use the same class as user messages
        messageElement.innerText = content;
    } else if (role === "bot") {
        // Bot message
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

    // Append message to chat box (or history-box)
    const historyBox = document.getElementById("history-box");
    if (historyBox) {
        historyBox.appendChild(messageElement);
        historyBox.scrollTop = historyBox.scrollHeight;  // Scroll to the bottom
    }

    // Append message to chat box if you're viewing full chat history
    const chatBox = document.getElementById("chat-box");
    if (chatBox) {
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
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

window.onload = async () => {
    try {
        const response = await fetch("/get_session_data");
        const data = await response.json();

        const userEmail = data.user_email;
        const username = data.username;
        let sessionId = data.session_id || localStorage.getItem("sessionId");

        // If no session ID, generate a new one and store in localStorage
        if (!sessionId) {
            sessionId = crypto.randomUUID();
            localStorage.setItem("sessionId", sessionId);
        }

        console.log("Username:", username);
        console.log("User Email:", userEmail);
        console.log("Session ID:", sessionId);

        // Display initial bot message
        if (username) {
            addMessage(`Kumusta, ${username}? Nandito ako para makinig at suportahan ka. 💙`, "bot");
        } else {
            addMessage("Kumusta? Nandito ako para makinig at suportahan ka. 💙", "bot");
        }

        // Check if both user email and session ID are available
        if (!userEmail || !sessionId) {
            console.error("No user session found.");
            return;
        }

        // Fetch session history summaries
        const historyResponse = await fetch(`/history`);
        const historyData = await historyResponse.json();

        const historyBox = document.getElementById("history-box");
        if (!historyBox) return;

        // Display session summaries in history-box
// Display session summaries in history-box
if (historyData.history_summaries && historyData.history_summaries.length > 0) {

    
    // Sort the history by timestamp to ensure it's ordered correctly
    const sortedHistory = historyData.history_summaries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Reverse the history if needed to show the latest history at the bottom   
    const reversedHistory = sortedHistory.reverse();

    reversedHistory.forEach(session => {
        const summaryDiv = document.createElement("div");
        summaryDiv.classList.add("history-item");

        // Add session summary content
        summaryDiv.innerHTML = `
            <p><strong>Bot:</strong> 
             ${session.last_bot_reply.length > 28 ? session.last_bot_reply.substring(0, 28) + "..." : session.last_bot_reply}
            </p>
            <p><strong><em></strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${new Date(session.timestamp).toLocaleTimeString()} &nbsp;&nbsp;${new Date(session.timestamp).toLocaleDateString()}</p>

        `;

        // Add an event listener to load full history when clicked
        summaryDiv.addEventListener("click", async () => {
            chatBox.innerHTML = "";  // Clear current chatbox content

            // Fetch full history for the clicked session
            const fullHistoryResponse = await fetch(`/session_history?session_id=${session.session_id}`);
            const fullHistoryData = await fullHistoryResponse.json();

            // Display the full history in the chatbox
            if (fullHistoryData.full_history && fullHistoryData.full_history.length > 0) {
                fullHistoryData.full_history.forEach(message => {
                    addMessageForHistory(message.messages[0].content, "user");  // User message
                    addMessageForHistory(message.messages[1].content, "bot");   // Bot reply
                });
            }

            chatBox.scrollTop = chatBox.scrollHeight;  // Scroll to the bottom of the chatbox
        });

        historyBox.appendChild(summaryDiv);  // Append session summary to history box
    });
} else {
    historyBox.innerHTML = "<p>No history available.</p>";  // No session history available
}

        

    } catch (error) {
        console.error("Error loading session or history:", error);
    }
};

document.getElementById('clear-chat-btn').addEventListener('click', function() {
    // Send a request to the server to generate a new session_id
    fetch('/reload-session', {
        method: 'POST',
        credentials: 'same-origin',  // To send cookies like session ID along with the request
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);  // For debugging or feedback
        location.reload();  // Reload the page to reset everything with a new session_id
    })
    .catch(error => {
        console.error('Error:', error);
    });
});
