const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const charCount = document.getElementById('char-count');
const typingIndicator = document.getElementById('typing-indicator');
const clearChatBtn = document.getElementById('clear-chat');
const saveChatBtn = document.getElementById('save-chat');
const scrollBottomBtn = document.getElementById('scroll-bottom');
const toggleModeBtn = document.getElementById('toggle-mode');
const msgSound = document.getElementById('msg-sound');

// Quick reply suggestions
const QUICK_REPLIES = [
    "I'm feeling anxious",
    "I'm feeling depressed",
    "I'm feeling stressed",
    "I'm feeling lonely",
    "I'm feeling good today",
    "I need help with sleep",
    "I want to talk about my feelings"
];

// Mood tracking
let moodHistory = [];

// Emergency Resources
const EMERGENCY_RESOURCES = {
    "National Suicide Prevention Lifeline": "1-800-273-8255",
    "Crisis Text Line": "Text HOME to 741741",
    "SAMHSA's National Helpline": "1-800-662-4357",
    "Veterans Crisis Line": "1-800-273-8255",
    "Disaster Distress Helpline": "1-800-985-5990"
};

// Breathing Exercise
const BREATHING_EXERCISE = {
    steps: [
        { text: "Find a comfortable position", duration: 3000 },
        { text: "Inhale deeply through your nose for 4 seconds", duration: 4000 },
        { text: "Hold your breath for 7 seconds", duration: 7000 },
        { text: "Exhale slowly through your mouth for 8 seconds", duration: 8000 },
        { text: "Repeat this cycle 4 times", duration: 0 }
    ]
};

// --- Sidebar Chat History ---
const chatHistoryList = document.querySelector('.chat-history-list');
const newChatBtn = document.querySelector('.new-chat-btn');
let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
let currentSessionIndex = 0;
let currentSessionId = null;

function getTime() {
    const now = new Date();
    return now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`;
    avatar.textContent = isUser ? '🧑' : '🤖';
    const msgContent = document.createElement('div');
    msgContent.className = 'msg-content';
    msgContent.innerHTML = `<p>${message}</p><span class="timestamp">${getTime()}</span>`;
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(msgContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (!isUser && msgSound) msgSound.play();
    
    if (isUser) {
        trackMood(message, true);
        addQuickReplies();
    }
    
    saveChatHistory();
    saveChatToSession();
}

function showTyping(show) {
    typingIndicator.hidden = !show;
}

function updateCharCount() {
    charCount.textContent = `${userInput.value.length}/300`;
    sendButton.disabled = userInput.value.trim().length === 0;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function checkScrollBtn() {
    if (chatMessages.scrollHeight - chatMessages.scrollTop > 400) {
        scrollBottomBtn.classList.remove('hidden');
    } else {
        scrollBottomBtn.classList.add('hidden');
    }
}

// Load chat sessions from backend
async function loadChatSessions() {
    try {
        const response = await fetch('/chat/sessions');
        const sessions = await response.json();
        updateChatHistoryList(sessions);
    } catch (error) {
        console.error('Error loading chat sessions:', error);
    }
}

// Update chat history list in sidebar
function updateChatHistoryList(sessions) {
    chatHistoryList.innerHTML = '';
    sessions.forEach(session => {
        const li = document.createElement('li');
        li.className = 'chat-history-item';
        if (session.id === currentSessionId) {
            li.classList.add('active');
        }
        li.innerHTML = `
            <span>${session.title}</span>
            <span class="chat-time">${new Date(session.created_at).toLocaleTimeString()}</span>
        `;
        li.onclick = () => loadChatSession(session.id);
        chatHistoryList.appendChild(li);
    });
}

// Load a specific chat session
async function loadChatSession(sessionId) {
    try {
        const response = await fetch(`/chat/sessions/${sessionId}`);
        const session = await response.json();
        currentSessionId = sessionId;
        
        // Clear current chat
        chatMessages.innerHTML = '';
        
        // Load messages
        session.messages.forEach(msg => {
            addMessage(msg.content, msg.is_user);
        });
        
        // Update active session in sidebar
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = Array.from(document.querySelectorAll('.chat-history-item'))
            .find(item => item.querySelector('span').textContent === session.title);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error loading chat session:', error);
    }
}

// Delete a chat session
async function deleteChatSession(sessionId) {
    try {
        const response = await fetch(`/chat/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            if (currentSessionId === sessionId) {
                currentSessionId = null;
                chatMessages.innerHTML = '';
                addMessage("Hello! I'm here to support you. How are you feeling today?", false);
            }
            await loadChatSessions();
        }
    } catch (error) {
        console.error('Error deleting chat session:', error);
    }
}

// New chat button handler
newChatBtn.addEventListener('click', () => {
    currentSessionId = null;
    chatMessages.innerHTML = '';
    addMessage("Hello! I'm here to support you. How are you feeling today?", false);
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.classList.remove('active');
    });
});

// Clear chat button handler
clearChatBtn.addEventListener('click', () => {
    if (currentSessionId) {
        deleteChatSession(currentSessionId);
    } else {
        chatMessages.innerHTML = '';
        addMessage("Hello! I'm here to support you. How are you feeling today?", false);
    }
});

// Modified sendMessage function
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = '';
    updateCharCount();
    typingIndicator.hidden = false;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                session_id: currentSessionId
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        addMessage(data.response, false);
        currentSessionId = data.session_id;
        await loadChatSessions();
    } catch (error) {
        console.error('Error sending message:', error);
        addMessage("Sorry, there was an error processing your message. Please try again.", false);
    } finally {
        typingIndicator.hidden = true;
    }
}

// Load chat sessions when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadChatSessions();
});

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
userInput.addEventListener('input', updateCharCount);
window.addEventListener('load', () => {
    userInput.focus();
    updateCharCount();
    loadChatHistory();
});
chatMessages.addEventListener('scroll', checkScrollBtn);
scrollBottomBtn.addEventListener('click', scrollToBottom);

saveChatBtn.addEventListener('click', () => {
    let text = '';
    document.querySelectorAll('.message').forEach(msg => {
        const who = msg.classList.contains('user') ? 'You' : 'Bot';
        const content = msg.querySelector('p').textContent;
        const time = msg.querySelector('.timestamp').textContent;
        text += `[${time}] ${who}: ${content}\n`;
    });
    const blob = new Blob([text], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chat.txt';
    a.click();
});

toggleModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    toggleModeBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});

// Accessibility: focus outlines
document.querySelectorAll('button, input').forEach(el => {
    el.addEventListener('focus', () => el.classList.add('focus'));
    el.addEventListener('blur', () => el.classList.remove('focus'));
});

function addQuickReplies() {
    const quickRepliesDiv = document.getElementById('quick-replies');
    quickRepliesDiv.innerHTML = '';
    QUICK_REPLIES.forEach(reply => {
        const button = document.createElement('button');
        button.textContent = reply;
        button.className = 'quick-reply-btn';
        button.onclick = () => {
            userInput.value = reply;
            updateCharCount();
            sendMessage();
        };
        quickRepliesDiv.appendChild(button);
    });
}

function trackMood(message, isUser) {
    if (isUser) {
        const moodKeywords = {
            'anxious': 'anxiety',
            'depressed': 'depression',
            'stressed': 'stress',
            'lonely': 'loneliness',
            'good': 'positive',
            'happy': 'positive',
            'sad': 'negative',
            'angry': 'negative'
        };
        
        const messageLower = message.toLowerCase();
        for (const [keyword, mood] of Object.entries(moodKeywords)) {
            if (messageLower.includes(keyword)) {
                moodHistory.push({
                    mood: mood,
                    timestamp: new Date().toISOString(),
                    message: message
                });
                break;
            }
        }
    }
}

// Add mood history display
function showMoodHistory() {
    const moodHistoryDiv = document.createElement('div');
    moodHistoryDiv.className = 'mood-history';
    moodHistoryDiv.innerHTML = `
        <h3>Your Mood History</h3>
        <div class="mood-stats">
            ${moodHistory.map(entry => `
                <div class="mood-entry">
                    <span class="mood-${entry.mood}">${entry.mood}</span>
                    <span class="mood-time">${new Date(entry.timestamp).toLocaleString()}</span>
                </div>
            `).join('')}
        </div>
    `;
    chatMessages.appendChild(moodHistoryDiv);
    scrollToBottom();
}

// Add mood history button to header
const moodHistoryBtn = document.createElement('button');
moodHistoryBtn.id = 'mood-history';
moodHistoryBtn.title = 'View mood history';
moodHistoryBtn.textContent = '📊';
moodHistoryBtn.onclick = showMoodHistory;
document.querySelector('.chat-header').appendChild(moodHistoryBtn);

function showEmergencyResources() {
    const resourcesDiv = document.createElement('div');
    resourcesDiv.className = 'emergency-resources';
    resourcesDiv.innerHTML = `
        <h3>Emergency Resources</h3>
        <p>If you're in crisis, please reach out to these resources:</p>
        <div class="resource-list">
            ${Object.entries(EMERGENCY_RESOURCES).map(([name, number]) => `
                <div class="resource-item">
                    <strong>${name}:</strong>
                    <a href="tel:${number.replace(/-/g, '')}">${number}</a>
                </div>
            `).join('')}
        </div>
    `;
    chatMessages.appendChild(resourcesDiv);
    scrollToBottom();
}

function startBreathingExercise() {
    let currentStep = 0;
    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'breathing-exercise';
    chatMessages.appendChild(exerciseDiv);
    
    function updateExercise() {
        if (currentStep >= BREATHING_EXERCISE.steps.length) {
            exerciseDiv.innerHTML = '<p>Exercise completed! How do you feel now?</p>';
            return;
        }
        
        const step = BREATHING_EXERCISE.steps[currentStep];
        exerciseDiv.innerHTML = `
            <h3>Breathing Exercise</h3>
            <div class="breathing-circle"></div>
            <p class="breathing-instruction">${step.text}</p>
            <div class="breathing-progress">
                ${currentStep + 1}/${BREATHING_EXERCISE.steps.length}
            </div>
        `;
        
        if (step.duration > 0) {
            setTimeout(() => {
                currentStep++;
                updateExercise();
            }, step.duration);
        }
    }
    
    updateExercise();
    scrollToBottom();
}

// Add emergency resources and breathing exercise buttons
const emergencyBtn = document.createElement('button');
emergencyBtn.id = 'emergency-resources';
emergencyBtn.title = 'Emergency Resources';
emergencyBtn.textContent = '🆘';
emergencyBtn.onclick = showEmergencyResources;
document.querySelector('.chat-header').appendChild(emergencyBtn);

const breathingBtn = document.createElement('button');
breathingBtn.id = 'breathing-exercise';
breathingBtn.title = 'Start Breathing Exercise';
breathingBtn.textContent = '🌬️';
breathingBtn.onclick = startBreathingExercise;
document.querySelector('.chat-header').appendChild(breathingBtn);

// Chat History Persistence
function saveChatHistory() {
    const messages = Array.from(chatMessages.querySelectorAll('.message')).map(msg => ({
        content: msg.querySelector('p').textContent,
        isUser: msg.classList.contains('user'),
        timestamp: msg.querySelector('.timestamp').textContent
    }));
    localStorage.setItem('chatHistory', JSON.stringify(messages));
    localStorage.setItem('moodHistory', JSON.stringify(moodHistory));
}

function loadChatHistory() {
    const savedMessages = localStorage.getItem('chatHistory');
    const savedMoods = localStorage.getItem('moodHistory');
    
    if (savedMessages) {
        chatMessages.innerHTML = '';
        JSON.parse(savedMessages).forEach(msg => {
            addMessage(msg.content, msg.isUser);
        });
    }
    
    if (savedMoods) {
        moodHistory = JSON.parse(savedMoods);
    }
}

function renderChatHistory() {
    chatHistoryList.innerHTML = '';
    chatSessions.forEach((session, idx) => {
        const li = document.createElement('li');
        li.className = 'chat-history-item' + (idx === currentSessionIndex ? ' active' : '');
        li.innerHTML = `<span>${session.title || 'Untitled Chat'}</span><span class="chat-time">${session.time || ''}</span>`;
        li.onclick = () => {
            currentSessionIndex = idx;
            saveSessions();
            loadChatFromSession();
            renderChatHistory();
        };
        chatHistoryList.appendChild(li);
    });
}

function saveSessions() {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
}

function startNewChat() {
    chatSessions.push({
        title: 'New Chat',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        messages: []
    });
    currentSessionIndex = chatSessions.length - 1;
    saveSessions();
    loadChatFromSession();
    renderChatHistory();
}

function loadChatFromSession() {
    chatMessages.innerHTML = '';
    const session = chatSessions[currentSessionIndex];
    if (session && session.messages && session.messages.length) {
        session.messages.forEach(msg => {
            addMessage(msg.content, msg.isUser);
        });
    } else {
        addMessage("Hello! I'm here to support you. How are you feeling today?", false);
    }
    scrollToBottom();
}

// Save chat to session on every message
function saveChatToSession() {
    if (!chatSessions[currentSessionIndex]) return;
    const messages = Array.from(chatMessages.querySelectorAll('.message')).map(msg => ({
        content: msg.querySelector('p').textContent,
        isUser: msg.classList.contains('user'),
        timestamp: msg.querySelector('.timestamp').textContent
    }));
    chatSessions[currentSessionIndex].messages = messages;
    // Use first user message as title
    const firstUserMsg = messages.find(m => m.isUser);
    if (firstUserMsg) chatSessions[currentSessionIndex].title = firstUserMsg.content.slice(0, 24) + (firstUserMsg.content.length > 24 ? '...' : '');
    saveSessions();
    renderChatHistory();
}

// --- Top Bar Actions ---
const signUpBtn = document.querySelector('.sign-up-btn');
signUpBtn.addEventListener('click', () => {
    alert('Sign up functionality coming soon!');
});

// Voice Typing
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');
let recognition = null;

// Add this test function at the beginning of the file
function testMicrophoneAndSpeech() {
    console.log('Testing microphone and speech recognition...');
    
    // Test microphone access
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            console.log('Microphone access successful');
            stream.getTracks().forEach(track => track.stop());
            
            // Test speech recognition
            if ('webkitSpeechRecognition' in window) {
                console.log('Speech recognition is available');
                const testRecognition = new webkitSpeechRecognition();
                testRecognition.onstart = () => console.log('Test recognition started');
                testRecognition.onerror = (event) => console.error('Test recognition error:', event.error);
                testRecognition.onend = () => console.log('Test recognition ended');
                testRecognition.start();
            } else {
                console.error('Speech recognition not available');
            }
        })
        .catch(error => {
            console.error('Microphone test failed:', error);
            if (error.name === 'NotAllowedError') {
                console.error('Microphone permission denied');
            } else if (error.name === 'NotFoundError') {
                console.error('No microphone found');
            } else {
                console.error('Unknown error:', error);
            }
        });
}

// Modify the initialization function
function initializeSpeechRecognition() {
    console.log('Initializing speech recognition...');
    
    if ('webkitSpeechRecognition' in window) {
        console.log('Speech recognition is supported');
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('Speech recognition started');
            voiceBtn.classList.add('listening');
            voiceStatus.style.display = 'block';
            voiceStatus.textContent = 'Listening...';
        };

        recognition.onresult = (event) => {
            console.log('Speech recognition result:', event);
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            updateCharCount();
            setTimeout(() => {
                sendMessage();
            }, 500);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event);
            let errorMessage = 'Error: ';
            switch(event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Please try again.';
                    break;
                case 'aborted':
                    errorMessage = 'Speech recognition was aborted.';
                    break;
                case 'audio-capture':
                    errorMessage = 'No microphone detected. Please check your microphone in System Settings > Privacy & Security > Microphone.';
                    break;
                case 'network':
                    errorMessage = 'Network error occurred. Please check your connection.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone access denied. Please allow microphone access in System Settings > Privacy & Security > Microphone and in your browser settings.';
                    break;
                case 'service-not-allowed':
                    errorMessage = 'Speech recognition service not allowed. Please check your browser settings.';
                    break;
                default:
                    errorMessage = `Error: ${event.error}`;
            }
            voiceStatus.textContent = errorMessage;
            voiceBtn.classList.remove('listening');
            setTimeout(() => {
                voiceStatus.style.display = 'none';
            }, 5000);
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            voiceBtn.classList.remove('listening');
            voiceStatus.style.display = 'none';
        };

        // Request microphone permission with detailed error handling
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                console.log('Microphone permission granted');
                voiceBtn.disabled = false;
                voiceBtn.title = 'Click to start voice typing';
            })
            .catch((error) => {
                console.error('Microphone permission denied:', error);
                let errorMessage = 'Microphone access denied. ';
                
                if (error.name === 'NotAllowedError') {
                    errorMessage += 'Please allow access in System Settings > Privacy & Security > Microphone and in your browser settings.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += 'No microphone found. Please check your microphone connection.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage += 'Microphone is busy or not accessible. Please close other applications using the microphone.';
                } else if (error.name === 'OverconstrainedError') {
                    errorMessage += 'Microphone configuration error. Please check your microphone settings.';
                } else {
                    errorMessage += `Error: ${error.message}`;
                }
                
                voiceStatus.textContent = errorMessage;
                voiceStatus.style.display = 'block';
                voiceBtn.disabled = true;
                voiceBtn.title = 'Microphone access denied';
            });

    } else {
        console.log('Speech recognition is not supported');
        voiceBtn.style.display = 'none';
        voiceStatus.textContent = 'Voice typing is not supported in your browser. Please use Chrome or Edge on macOS.';
        voiceStatus.style.display = 'block';
    }
}

// Add test button to the page
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
    
    // Add test button
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Microphone & Speech';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '20px';
    testButton.style.left = '20px';
    testButton.style.zIndex = '1000';
    testButton.style.padding = '10px';
    testButton.style.backgroundColor = '#7c3aed';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '5px';
    testButton.style.cursor = 'pointer';
    testButton.onclick = testMicrophoneAndSpeech;
    document.body.appendChild(testButton);
    
    voiceBtn.addEventListener('click', () => {
        if (!recognition) {
            console.error('Speech recognition not initialized');
            voiceStatus.textContent = 'Speech recognition not initialized. Please refresh the page.';
            voiceStatus.style.display = 'block';
            setTimeout(() => {
                voiceStatus.style.display = 'none';
            }, 3000);
            return;
        }

        if (voiceBtn.classList.contains('listening')) {
            console.log('Stopping speech recognition');
            recognition.stop();
        } else {
            try {
                console.log('Starting speech recognition');
                recognition.start();
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                voiceStatus.textContent = `Error starting voice recognition: ${error.message}`;
                voiceStatus.style.display = 'block';
                setTimeout(() => {
                    voiceStatus.style.display = 'none';
                }, 3000);
            }
        }
    });
});