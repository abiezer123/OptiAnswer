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

        # Find user by username and password
        user = users.find_one({"username": username, "password": password})

        if user:
            # If user is found, store their email and username in the session
            session["user_email"] = user["email"]
            session["user_name"] = user["username"]

            print(f"User logged in: Email = {user['email']}, Username = {user['username']}")

            return redirect(url_for("main"))
        else:
            flash("Invalid username or password.", "danger")
            return redirect(url_for("signin"))

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

            # Redirect to main page or dashboard after successful registration
            return redirect(url_for("main"))
        
    return render_template("verify.html")

@app.route("/main")
def main():
    return render_template("main.html")  # Example template


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

        if email:
            # Save email and username to session
            session["user_email"] = email
            session["user_name"] = username

            print(f"User logged in: Email = {email}, Username = {username}")

            # Check if the email exists in the database
            existing_user = users.find_one({"email": email})

            if existing_user:
                # If the user exists, just redirect to the main page
                return redirect(url_for("main"))
            else:
                # If the email doesn't exist in the database, create a new user
                users.insert_one({"email": email, "username": username})

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
def get_history_chats():
    user_email = session.get("user_email")  # Get the email from the session
    
    if not user_email:
        return jsonify({"error": "User is not authenticated."}), 403  # Handle case where user is not logged in

    # Fetch history for the logged-in user
    chats = list(history_collection.find({"user_id": user_email}, {"_id": 0}))  # Fetch history based on email (user_id)

    return jsonify({"history": chats})


@app.route("/chat", methods=["POST"])
def chat():
    # Retrieve user data from the request
    user_data = request.get_json()
    user_message = user_data.get("message", "")

    # Retrieve the user ID (email) from the session (this assumes the user is logged in)
    user_id = session.get("email")  # Use email or any other unique identifier

    if not user_id:
        return jsonify({"error": "User is not authenticated"}), 403  # Handle case where the user is not authenticated

    try:
        # Make the API request to the chatbot
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions", 
            json={
                "model": "openai/gpt-4o-mini",
                "messages": [system_message, {"role": "user", "content": user_message}],
                "max_tokens": 150,
                "temperature": 0.8,
            },
            headers={"Authorization": f"Bearer {API_KEY}"}
        )

        # Check if the response is valid (status code 200)
        if response.status_code == 200:
            data = response.json()
            bot_reply = data.get("choices", [{}])[0].get("message", {}).get("content", "Nandito ako para makinig. Ano ang nasa isip mo ngayon?")
        else:
            # If the API request fails, return a generic error message
            bot_reply = "Pasensya na, nagkaroon ng error sa pagkuha ng sagot."

    except Exception as e:
        # Catch any other exceptions that occur during the request
        print("Error during API request:", e)
        bot_reply = "Pasensya na, hindi kita naintindihan. Pwede mo bang ulitin?"

    # Save the user message and bot reply to the database with the user_id (email)
    result = history_collection.insert_one({
        "user_id": user_id,  # Store the user's email (or any other identifier)
        "user": user_message,  # Store the user's message
        "bot": bot_reply,  # Store the bot's reply
        "timestamp": datetime.now()  # Timestamp for the conversation
    })

    print("MongoDB Inserted ID:", result.inserted_id)  # Debug log

    # Return the bot's response to the user
    return jsonify({"reply": bot_reply})

# Logout
@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("index"))

# Start Flask App
if __name__ == '__main__':
    app.run(debug=True)
