import os
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

# Home Page
@app.route("/")
def index():
    return render_template("index.html")

# Send OTP Email
def send_otp_email(to_email, otp):
    msg = Message("Your OTP Verification Code", recipients=[to_email])
    msg.body = f"Your OTP code is: {otp}\n\nPlease use this code to verify your email."
    mail.send(msg)

# Generate OTP and Send Email
# Inside send_otp route
@app.route("/send_otp", methods=["POST"])
def send_otp():
    email = request.form.get("email")
    print(f"Sending OTP to: {email}")  # Add this line to debug

    # Generate a random 6-digit OTP
    otp = random.randint(100000, 999999)

    # Store OTP and expiration time in the database
    expiration_time = datetime.now() + timedelta(minutes=10)  # OTP expires in 10 minutes
    otps.insert_one({"email": email, "otp": otp, "expires_at": expiration_time})

    # Store OTP in session for verification later
    session["otp"] = otp  # Store OTP in session
    session["email"] = email

    # Send OTP to the user's email
    send_otp_email(email, otp)

    flash("OTP sent to your email. Please check your inbox.", "info")
    return redirect(url_for("verify"))

# OTP Verification Page
# OTP Verification Page
@app.route("/verify", methods=["GET", "POST"])
def verify():
    if request.method == "POST":
        entered_otp = request.form.get("otp")
        
        if str(session.get("otp")) == entered_otp:  # Use session.get() to avoid KeyError
            flash("OTP verified successfully!", "success")

            # Save the email to the MongoDB 'users' collection
            email = session.get("email")  # Get the email from the session
            if email:
                # Check if the email already exists in the 'users' collection
                if not users.find_one({"email": email}):
                    users.insert_one({"email": email})
            
            return redirect(url_for("main"))  # Redirect to 'main' route after successful OTP verification
        else:
            flash("Invalid OTP. Please try again.", "danger")

    return render_template("verify.html")


@app.route("/main")
def main():
    return render_template("main.html")  # Example template

# Google OAuth Callback
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

# Google Login Route
@app.route("/google")
def google_login():
    session.clear()
    return redirect(url_for("google.login"))

# Logout
@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("index"))

# Start Flask App
if __name__ == '__main__':
    app.run(debug=True)
