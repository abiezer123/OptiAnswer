import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_dance.contrib.google import make_google_blueprint, google
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from flask_session import Session

# ✅ Allow OAuth to work over HTTP (For local development only)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# 🔑 Set secret key for sessions
app.secret_key = os.getenv("SECRET_KEY", "default_secret_key")

# 🔄 Flask-Session Configuration
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

@app.route("/clear")
def clear():
    session.clear()
    return "Session cleared!"

# 🔗 Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client["chatbot_db"]
history_collection = db["history"]
users = db["user"]

# ✅ Google OAuth setup
google_bp = make_google_blueprint(
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    scope=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    redirect_to="google_callback"
)


app.register_blueprint(google_bp, url_prefix="/login")

# 🔍 OpenRouter API Config
API_URL = "https://openrouter.ai/api/v1/chat/completions"
API_KEY = os.getenv("OPENROUTER_API_KEY")

# 📌 System Message for AI
system_message = {
    "role": "system",
    "content": "Ikaw ay isang kaibigan na handang makinig at magbigay ng suporta. Huwag magbigay ng inpormasyon na hindi kaugnay sa mental health. Maging magiliw at sumagot lamang sa Tagalog. Magbigay ng payo kung nararamdaman mong kailangan ko ito bilang kausap."
}

# 🏠 Home Page
@app.route("/")
def index():
    return render_template("index.html")

# 🗂 Get Chat History (User-Specific)
@app.route("/history", methods=["GET"])
def get_history_chats():
    if "user" not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    user_email = session["user"]
    chats = list(history_collection.find({"email": user_email}, {"_id": 0}))  
    return jsonify({"history": chats})

# 💾 Save Chat (User-Specific)
@app.route("/save_chat", methods=["POST"])
def save_chat():
    if "user" not in session:
        return jsonify({"error": "User not logged in"}), 401

    user_data = request.get_json()
    message = user_data.get("message", "")
    bot_reply = user_data.get("reply", "")

    if message and bot_reply:
        history_collection.insert_one({"email": session["user"], "user": message, "bot": bot_reply})

    return jsonify({"status": "saved"})

# 🤖 Chat with OpenRouter AI
@app.route("/chat", methods=["POST"])
def chat():
    if "user" not in session:
        return jsonify({"error": "User not logged in"}), 401

    user_data = request.get_json()
    user_message = user_data.get("message", "")

    # Retrieve user's chat history
    user_history = list(history_collection.find({"email": session["user"]}, {"_id": 0}))[-4:]
    conversation_history = [{"role": "user", "content": h["user"]} for h in user_history]
    conversation_history.append({"role": "user", "content": user_message})

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(API_URL, json={
            "model": "openai/gpt-4o-mini",
            "messages": [system_message] + conversation_history,
            "max_tokens": 150,
            "temperature": 0.8,
        }, headers=headers)

        data = response.json()
        bot_reply = data.get("choices", [{}])[0].get("message", {}).get("content", "Nandito ako para makinig. Ano ang nasa isip mo ngayon?")
        
        history_collection.insert_one({"email": session["user"], "user": user_message, "bot": bot_reply})

        return jsonify({"reply": bot_reply})

    except Exception as e:
        print("Error during API request:", e)
        return jsonify({"reply": "Pasensya na, hindi kita naintindihan. Pwede mo bang ulitin?"})

# 📢 Google OAuth Callback
@app.route("/google/callback")
def google_callback():
    if not google.authorized:
        return redirect(url_for("google_login"))

    try:
        resp = google.get("/oauth2/v2/userinfo")
        user_info = resp.json()
    except Exception as e:
        print("Error fetching user info:", e)
        return redirect(url_for("index"))

    email = user_info.get("email", "Unknown")

    if not users.find_one({"email": email}):
        users.insert_one({"email": email})

    session["user"] = email  
    return redirect(url_for("main"))

# 📢 Google Login Route
@app.route("/google")
def google_login():
    session.clear()
    return redirect(url_for("google.login"))

# 🔒 Logout
@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("index"))

# 🏡 Main Page
@app.route('/main')
def main():
    if "user" not in session:
        return redirect(url_for("index"))
    return render_template('main.html')

# 🚀 Start Flask App
if __name__ == '__main__':
    app.run(debug=True)
