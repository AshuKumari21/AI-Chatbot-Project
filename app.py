from flask import Flask, render_template, request, jsonify, send_from_directory
import logging
import random
import google.generativeai as genai
import os
from models import db, ChatSession, ChatMessage
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, 
            static_folder='static',
            static_url_path='/static')

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat_history.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Create database tables
with app.app_context():
    db.create_all()

# Simple response templates
RESPONSE_TEMPLATES = {
    "greeting": [
        "Hello! How are you feeling today?",
        "Hi there! I'm here to listen. How can I help you?",
        "Welcome! I'm here to support you. How are you doing?"
    ],
    "feeling_bad": [
        "I'm sorry to hear that you're feeling this way. Would you like to talk about what's bothering you?",
        "It's okay to not feel okay. I'm here to listen if you want to share more.",
        "I understand this is difficult. Remember, it's okay to feel this way. Would you like to talk about it?"
    ],
    "feeling_good": [
        "That's great to hear! I'm glad you're feeling positive today.",
        "It's wonderful that you're feeling good! Is there anything specific that's contributing to your positive mood?",
        "That's fantastic! Would you like to share what's making you feel this way?"
    ],
    "stress": [
        "It sounds like you're feeling stressed. Would you like to talk about what's causing your stress? Sometimes sharing your thoughts can help.",
        "Stress can be tough to manage. Have you tried any relaxation techniques, like deep breathing or a short walk?",
        "Remember, it's okay to take breaks and care for yourself. What's been stressing you out lately?"
    ],
    "sleep": [
        "Sleep is so important for mental health. Are you having trouble sleeping?",
        "If you're struggling with sleep, try to keep a regular routine and avoid screens before bed.",
        "Would you like to talk more about your sleep issues? Sometimes sharing your routine can help find solutions."
    ],
    "motivation": [
        "It's normal to feel unmotivated sometimes. Is there something specific you're struggling to start?",
        "Setting small, achievable goals can help build motivation. Would you like to talk about what you want to accomplish?",
        "Remember to be kind to yourself. Motivation can come and go, and that's okay."
    ],
    "lonely": [
        "Feeling lonely can be really hard. Remember, you're not alone and there are people who care.",
        "Would you like to talk about what's making you feel lonely?",
        "Sometimes reaching out to a friend or family member can help. Is there someone you trust you could talk to?"
    ],
    "default": [
        "I'm here to listen and support you. Could you tell me more about how you're feeling?",
        "I understand this might be difficult to talk about. Take your time, I'm here to listen.",
        "Your feelings are valid and important. Would you like to share more about what's on your mind?"
    ]
}

# Set your Gemini API key
genai.configure(api_key="AIzaSyCSkgyOoTg_pPLZI-iZhh4LVKBOO2i2Nao")

def get_response(user_message):
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(user_message)
        if hasattr(response, "text"):
            return response.text
        elif hasattr(response, "candidates") and response.candidates:
            return response.candidates[0].content.parts[0].text
        else:
            return "Sorry, I couldn't generate a response. Please try again."
    except Exception as e:
        logger.error(f"Error from Gemini API: {str(e)}", exc_info=True)
        return "Sorry, there was an error processing your request."

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        logger.debug("Received chat request")
        user_message = request.json['message']
        session_id = request.json.get('session_id')
        logger.debug(f"User message: {user_message}")
        
        if not user_message.strip():
            return jsonify({
                'error': 'Message cannot be empty'
            }), 400

        # Create new session if none exists
        if not session_id:
            session = ChatSession(title=user_message[:50] + "..." if len(user_message) > 50 else user_message)
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        else:
            session = ChatSession.query.get(session_id)
            if not session:
                return jsonify({'error': 'Invalid session ID'}), 400

        # Save user message
        user_msg = ChatMessage(content=user_message, is_user=True, session_id=session_id)
        db.session.add(user_msg)

        # Get bot response
        response = get_response(user_message)
        logger.debug(f"Bot response: {response}")
        
        # Save bot response
        bot_msg = ChatMessage(content=response, is_user=False, session_id=session_id)
        db.session.add(bot_msg)
        db.session.commit()
        
        return jsonify({
            'response': response,
            'session_id': session_id
        })
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'error': f"An error occurred: {str(e)}"
        }), 500

@app.route('/chat/sessions', methods=['GET'])
def get_chat_sessions():
    try:
        sessions = ChatSession.query.order_by(ChatSession.created_at.desc()).all()
        return jsonify([{
            'id': session.id,
            'title': session.title,
            'created_at': session.created_at.isoformat(),
            'message_count': len(session.messages)
        } for session in sessions])
    except Exception as e:
        logger.error(f"Error getting chat sessions: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/chat/sessions/<int:session_id>', methods=['GET'])
def get_chat_session(session_id):
    try:
        session = ChatSession.query.get_or_404(session_id)
        messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()
        return jsonify({
            'id': session.id,
            'title': session.title,
            'created_at': session.created_at.isoformat(),
            'messages': [{
                'content': msg.content,
                'is_user': msg.is_user,
                'timestamp': msg.timestamp.isoformat()
            } for msg in messages]
        })
    except Exception as e:
        logger.error(f"Error getting chat session: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/chat/sessions/<int:session_id>', methods=['DELETE'])
def delete_chat_session(session_id):
    try:
        session = ChatSession.query.get_or_404(session_id)
        db.session.delete(session)
        db.session.commit()
        return jsonify({'message': 'Session deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting chat session: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

@app.route('/particles.js')
def serve_particles():
    return send_from_directory(app.static_folder, 'particles.js')

@app.route('/msg.mp3')
def serve_audio():
    return send_from_directory(app.static_folder, 'msg.mp3')

@app.route('/logo.png')
def serve_logo():
    return send_from_directory(app.static_folder, 'logo.avif')

if __name__ == '__main__':
    app.run(debug=True) 