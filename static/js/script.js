const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

const API_URL = "/chat"; // Updated to match Flask API route
const systemMessage = {
    role: "system",
    content: "Ikaw ay isang kaibigan na handang makinig at magbigay ng suporta. Huwag magbigay ng inpormasyon na hindi kaugnay sa mental health. Maging magiliw at sumagot lamang sa Tagalog. Magbigay ng payo kung nararamdaman mong kailangan ko ito bilang kausap."
};

let conversationHistory = [];
let recentTopics = []; 

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
            body: JSON.stringify({
                message: message,
                recent_topics: recentTopics.length > 0 ? recentTopics : undefined
            }),
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

        
          // Add the conversation start time at the beginning
          const startTime = new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          const startTimeDiv = document.createElement("div");
          startTimeDiv.classList.add("time-divider");
          startTimeDiv.innerText = `${startTime}`;
          chatBox.appendChild(startTimeDiv);
          
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
        
            const newSessionId = session.session_id;
            localStorage.setItem("sessionId", newSessionId);  // Set new sessionId
        
            // Optionally notify server of new session switch (requires /set_session route in Flask)
            await fetch("/set_session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: newSessionId })
            });
        
            // Fetch full history for the clicked session
            const fullHistoryResponse = await fetch(`/session_history?session_id=${newSessionId}`);
            const fullHistoryData = await fullHistoryResponse.json();
        
            let lastTopic = "Bagong usapan"; // default fallback
            let previousTimestamp = null;
        
            if (fullHistoryData.full_history && fullHistoryData.full_history.length > 0) {
                recentTopics = [];  // Reset

                let previousTimestamp = null;

                renderFullChatWithDividers(fullHistoryData.full_history);

         
                // Use last bot reply as the topic
                const lastBotReply = fullHistoryData.full_history[fullHistoryData.full_history.length - 1].messages[1].content;
                lastTopic = lastBotReply.length > 60 ? lastBotReply.substring(0, 60) + "..." : lastBotReply;
            }
        
            chatBox.scrollTop = chatBox.scrollHeight;
        
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


function renderFullChatWithDividers(fullHistory) {
    chatBox.innerHTML = "";
    let previousTimestamp = null;

    fullHistory.forEach((message, index) => {
        const userMsg = message.messages[0].content;
        const botMsg = message.messages[1].content;
        const currentTimestamp = new Date(message.timestamp);  // Use timestamp from response

        if (previousTimestamp) {
            const timeDifference = currentTimestamp - previousTimestamp;

            // More than 24 hours (1 day)
            if (timeDifference > 24 * 60 * 60 * 1000) {
                const formattedDate = currentTimestamp.toLocaleString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                });
                const timeDivider = document.createElement("div");
                timeDivider.classList.add("time-divider");
                timeDivider.innerText = `${formattedDate}`;
                chatBox.appendChild(timeDivider);
            }
            // More than a month
            else if (timeDifference > 30 * 24 * 60 * 60 * 1000) {
                const formattedDate = currentTimestamp.toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                });
                const timeDivider = document.createElement("div");
                timeDivider.classList.add("time-divider");
                timeDivider.innerText = `${formattedDate}`;
                chatBox.appendChild(timeDivider);
            }
            // More than 30 minutes (but less than 24 hours)
            else if (timeDifference > 30 * 60 * 1000) {
                const timeDivider = document.createElement("div");
                timeDivider.classList.add("time-divider");
                timeDivider.innerText = `${currentTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                chatBox.appendChild(timeDivider);
            }
        }

        addMessageForHistory(userMsg, "user");
        addMessageForHistory(botMsg, "bot");

        previousTimestamp = currentTimestamp;
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}
