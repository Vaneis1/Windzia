import os
import secrets
from datetime import datetime, timedelta
 
import httpx
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required
 
from models import db, Owner
from utils import hash_password, check_password, get_current_owner, require_auth
 
auth_bp = Blueprint("auth", __name__)
 
 
@auth_bp.route("/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email = body.get("email", "").lower().strip()
    password = body.get("password", "")
 
    if not email or not password:
        return jsonify({"error": "Email i hasło są wymagane"}), 400
 
    owner = Owner.query.filter_by(email=email).first()
    if not owner or not check_password(password, owner.password_hash):
        return jsonify({"error": "Nieprawidłowy email lub hasło"}), 401
 
    token = create_access_token(identity=str(owner.id))
    return jsonify({
        "token": token,
        "role": owner.role,
        "username": owner.username,
        "id": owner.id,
    })
 
 
@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():
    owner = get_current_owner()
    return jsonify({
        "id": owner.id,
        "username": owner.username,
        "email": owner.email,
        "role": owner.role,
    })
 
 
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    body = request.get_json(silent=True) or {}
    email = body.get("email", "").lower().strip()
 
    # Always return ok — don't reveal whether email exists
    owner = Owner.query.filter_by(email=email).first()
    if not owner:
        return jsonify({"ok": True})
 
    token = secrets.token_urlsafe(32)
    owner.reset_token = token
    owner.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
 
    frontend_url = os.environ.get("FRONTEND_URL", "https://vaneis1.github.io/Windzia")
    reset_url = f"{frontend_url}?reset={token}"
    resend_key = os.environ.get("RESEND_API_KEY", "")
 
    if resend_key:
        try:
            httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "Wandzi Windzi <noreply@resend.dev>",
                    "to": [email],
                    "subject": "Reset hasła — Wandzi Windzi",
                    "html": (
                        f"<p>Kliknij poniższy link aby zresetować hasło "
                        f"(ważny 1 godzinę):</p>"
                        f"<p><a href='{reset_url}'>{reset_url}</a></p>"
                    ),
                },
                timeout=10,
            )
        except Exception:
            pass  # Email failure should not block the response
 
    return jsonify({"ok": True})
 
 
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    body = request.get_json(silent=True) or {}
    token = body.get("token", "")
    new_password = body.get("password", "")
 
    if len(new_password) < 6:
        return jsonify({"error": "Hasło musi mieć minimum 6 znaków"}), 400
 
    owner = Owner.query.filter_by(reset_token=token).first()
    if not owner or not owner.reset_token_expires:
        return jsonify({"error": "Token jest nieprawidłowy"}), 400
    if owner.reset_token_expires < datetime.utcnow():
        return jsonify({"error": "Token wygasł — wygeneruj nowy"}), 400
 
    owner.password_hash = hash_password(new_password)
    owner.reset_token = None
    owner.reset_token_expires = None
    db.session.commit()
    return jsonify({"ok": True})
