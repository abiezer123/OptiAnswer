import os
import requests
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_dance.contrib.google import make_google_blueprint, google
from pymongo import MongoClient
from dotenv import load_dotenv
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
import random
from flask_session import Session
from datetime import datetime, timedelta
from bson import ObjectId


# Allow OAuth to work over HTTP (For local development only)
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

# Flask-Mail Setup
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = os.getenv("MAIL_USERNAME")
app.config['MAIL_PASSWORD'] = os.getenv("MAIL_PASSWORD")
app.config['MAIL_DEFAULT_SENDER'] = os.getenv("MAIL_USERNAME")
mail = Mail(app)

# 🔗 Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client["chatbot_db"]
history_collection = db["history"]
users = db["user"]
otps = db["otp_verification"]  # New collection for OTP storage

# Google OAuth setup
google_bp = make_google_blueprint(
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    scope=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    redirect_to="google_callback"
)
app.register_blueprint(google_bp, url_prefix="/login")

# Setup Serializer for OTP Token
s = URLSafeTimedSerializer(app.config['SECRET_KEY'])

API_KEY = os.getenv("OPENROUTER_API_KEY")

system_message = {
    "role": "system",
    "content": "Ikaw ay isang kaibigan na handang makinig at magbigay ng suporta. Huwag magbigay ng inpormasyon na na hindi kaugnay sa mental health. Maging magiliw at sumagot lamang sa Tagalog. Magbigay ng payo kung nararamdaman mong kailangan ko ito bilang kausap."
}

conversation_history = []


# Home Page
@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        email = request.form.get("email")
        session["email"] = email  # Store email in session
        return redirect(url_for("signup"))  # Redirect to signup page
    return render_template("index.html")

# Signup route

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        # Get data from the form
        email = request.form.get("email")
        username = request.form.get("username")
        password = request.form.get("password")

        # Store email and username in session
        session["user_email"] = email
        session["user_name"] = username

        # Save the user to the database
        users.insert_one({"email": email, "username": username, "password": password})

        return redirect(url_for("main"))

    return render_template("signup.html")

# Sign In Route
@app.route("/signin", methods=["GET", "POST"])
def signin():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        # Find the user in the database by username and password
        user = users.find_one({"username": username, "password": password})

        if user:
              # Store email and username in session
            session["user_email"] = user.get("email")
            session["user_name"] = username
            
            return redirect(url_for("main"))
        else:
            flash("Invalid username or password. Please try again.", "danger")

    return render_template("signin.html") 


# Send OTP Email
def send_otp_email(to_email, otp):
    msg = Message("Your OTP Verification Code", recipients=[to_email])
    msg.body = f"Your OTP code is: {otp}\n\nPlease use this code to verify your email."
    mail.send(msg)

@app.route("/send_otp", methods=["POST"])
def send_otp():
    email = session.get("email")  # Email from index.html
    username = request.form.get("username")
    password = request.form.get("password")

    # Store username and password in session for later use
    session["username"] = username
    session["password"] = password

    # Generate OTP
    otp = random.randint(100000, 999999)
    expiration_time = datetime.now() + timedelta(minutes=10)

    # Save OTP in MongoDB for verification
    otps.insert_one({"email": email, "otp": otp, "expires_at": expiration_time})

    session["otp"] = otp

    # Send OTP via email
    send_otp_email(email, otp)

    return redirect(url_for("verify"))



# OTP Verification Page
@app.route("/verify", methods=["GET", "POST"])
def verify():
    if request.method == "POST":
        entered_otp = request.form.get("otp")

        if str(session.get("otp")) == entered_otp:  # Compare with session OTP
            

            # Retrieve email, username, and password from session
            email = session.get("email")
            username = session.get("username")
            password = session.get("password")

            print(f"User signed up: Email = {email}, Username = {username}")

            # Insert data into the MongoDB 'users' collection
            if email and username and password:
                existing_user = users.find_one({"email": email})
                if not existing_user:  # If email doesn't already exist
                    users.insert_one({"email": email, "username": username, "password": password})

            session["user_email"] = email
            session["user_name"] = username
            
            # Redirect to main page or dashboard after successful registration
            return redirect(url_for("main"))
        
    return render_template("verify.html")

from flask import url_for

@app.route("/main")
def main():
    # Check if session_id exists, create it if not
    if "session_id" not in session:
        session["session_id"] = str(ObjectId())  # Generate a unique session_id for each session

    # Fetch user profile image from MongoDB
    user_email = session.get("user_email")
    
    if user_email:
        user = users.find_one({"email": user_email})  # Fetch the user from the database using the email from session
        if user and user.get("profile_image"):
            profile_image_url = user["profile_image"]  # Get the profile image from user document
        else:
            profile_image_url = None  # If no profile image, set to None
    else:
        profile_image_url = None  # If no email in session, set to None

    return render_template("main.html", profile_image=profile_image_url)

@app.route("/google/callback")
def google_callback():
    if not google.authorized:
        return redirect(url_for("index"))

    try:
        # Fetch the user info from Google after successful authorization
        resp = google.get("/oauth2/v2/userinfo")
        user_info = resp.json()

        # Extract the email and username from the response
        email = user_info.get("email", None)
        username = user_info.get("name", None)  # Google provides the 'name' as the username
        profile_image_url = user_info.get("picture", None)

        if email:
            # Save email and username to session
            session["user_email"] = email
            session["user_name"] = username
            session["profile_image"] = profile_image_url

            print(f"User logged in via Google: Email = {email}, Username = {username}")  # Debug log

            # Check if the email exists in the database
            existing_user = users.find_one({"email": email})
            {"$set": {"profile_image": profile_image_url}} 

            if existing_user:
                # If the user exists, just redirect to the main page
                return redirect(url_for("main"))
            else:
                # If the email doesn't exist in the database, create a new user
                users.insert_one({"email": email, "username": username, "profile_image": profile_image_url})

                # After saving the new user, redirect to the main page
                return redirect(url_for("main"))

        else:
            return redirect(url_for("index"))

    except Exception as e:
        print(f"Error fetching user info: {e}")
        return redirect(url_for("index"))

# Google Login Route
@app.route("/google")
def google_login():
    session.clear()  # Clear any existing session
    return redirect(url_for("google.login"))


@app.route("/history", methods=["GET"])
def get_user_history():
    user_email = session.get("user_email")  # Get the email from the session

    if not user_email:
        return jsonify({"error": "User is not authenticated."}), 403

    # Fetch the latest message from each session for the user
    pipeline = [
        {"$match": {"user_id": user_email}},  # Match the user based on email
        {"$sort": {"timestamp": -1}},  # Sort by timestamp to get most recent messages
        {"$group": {
            "_id": "$session_id",  # Group by session_id
            "latest_message": {"$first": "$$ROOT"}  # Get the latest message for each session
        }},
        {"$project": {
            "_id": 0,
            "session_id": "$_id",
            "last_user_message": "$latest_message.user",
            "last_bot_reply": "$latest_message.bot",
            "timestamp": "$latest_message.timestamp"
        }}
    ]
    
    session_summaries = list(history_collection.aggregate(pipeline))

    return jsonify({"history_summaries": session_summaries})

@app.route("/session_history", methods=["GET"])
def get_session_full_history():
    user_email = session.get("user_email")  # Get the email from the session
    session_id = request.args.get("session_id")  # Get the session_id from the query parameters

    if not user_email:
        return jsonify({"error": "User is not authenticated."}), 403
    
    if not session_id:
        return jsonify({"error": "Session ID is required."}), 400

    # Fetch the full history for the given session_id
    full_history = list(history_collection.find({"user_id": user_email, "session_id": session_id}, {"_id": 0}))

    formatted_history = []
    for history_item in full_history:
        bot_reply = history_item.get('bot', "[Walang sagot mula sa bot]")
        user_message = history_item.get('user', "[Walang user message]")

        formatted_history.append({
            "bot": bot_reply,
            "messages": [
                {"role": "user", "content": user_message},
                {"role": "bot", "content": bot_reply}
            ]
        })

    return jsonify({"full_history": formatted_history})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message")
    recent_topics = data.get("recent_topics", [])


    user_id = session.get("user_email")
    session_id = session.get("session_id")

    if not user_id:
        return jsonify({"error": "User is not authenticated"}), 403

    # 🧠 Build conversation messages
    messages = [system_message]

    # If recent topics are provided, inject them into context
    if recent_topics:
        for topic in recent_topics:
            messages.append({
                "role": "assistant",
                "content": topic
            })

    # Then add the latest user input
    messages.append({"role": "user", "content": message})

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json={
                "model": "openai/gpt-4o-mini",
                "messages": messages,
                "max_tokens": 150,
                "temperature": 0.8,
            },
            headers={"Authorization": f"Bearer {API_KEY}"}
        )

        if response.status_code == 200:
            data = response.json()
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                bot_reply = choices[0]["message"].get("content", "")
            else:
                bot_reply = "Nandito ako para makinig. Ano ang nasa isip mo ngayon?"
        else:
            bot_reply = "Pasensya na, nagkaroon ng error sa pagkuha ng sagot."

    except Exception as e:
        print(f"Error making API request: {e}")
        bot_reply = "Pasensya na, nagkaroon ng error."

    # Save the conversation to MongoDB
    message_doc = {
        "user_id": user_id,
        "session_id": session_id,
        "user": message,
        "bot": bot_reply,
        "timestamp": datetime.now(),
    }
    history_collection.insert_one(message_doc)

    return jsonify({"reply": bot_reply})



@app.route("/get_session_data")
def get_session_data():
    user_email = session.get("user_email")
    username = session.get("user_name")
    return jsonify({
        "user_email": user_email,
        "username": username
    })

@app.route("/reload-session", methods=["POST"])
def reload_session():
    session["session_id"] = str(ObjectId())  # Create a new session_id
    return jsonify({"message": "New session ID generated."}), 200


@app.route("/set_session", methods=["POST"])
def set_session():
    data = request.get_json()
    new_session_id = data.get("session_id")

    if new_session_id:
        session["session_id"] = new_session_id  # 🔄 Update the session
        return jsonify({"message": "Session ID updated successfully"})
    else:
        return jsonify({"error": "No session_id provided"}), 400




@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()  # Clear the session data
    session["session_id"] = str(ObjectId())  
    return redirect(url_for("index"))  # Redirect to the index page


# Start Flask App
if __name__ == '__main__':
    app.run(debug=True)
