from flask import Blueprint, request, jsonify
from models import db, Character
from utils import get_current_owner, require_auth
 
profiles_bp = Blueprint("profiles", __name__)
 
 
@profiles_bp.route("/characters/<int:cid>/profile", methods=["GET"])
def get_profile(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    return jsonify({
        "id": char.id,
        "name": char.name,
        "owner_username": char.owner.username if char.owner else "",
        "owner_display": char.owner.display_name or char.owner.username if char.owner else "",
        "profile_blocks": char.profile_blocks or [],
        "profile_public": char.profile_public,
        "avatar_url": char.avatar_url,
    })
 
 
@profiles_bp.route("/characters/<int:cid>/profile", methods=["PUT"])
@require_auth
def save_profile(cid):
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403
 
    body = request.get_json(silent=True) or {}
    if "profile_blocks" in body:
        char.profile_blocks = body["profile_blocks"]
    if "profile_public" in body:
        char.profile_public = bool(body["profile_public"])
    if "avatar_url" in body:
        char.avatar_url = body.get("avatar_url") or None
 
    db.session.commit()
    return jsonify({"ok": True})
 
 
@profiles_bp.route("/profiles/public", methods=["GET"])
def list_public_profiles():
    chars = Character.query.filter_by(profile_public=True).all()
    return jsonify([{
        "id": c.id,
        "name": c.name,
        "avatar_url": c.avatar_url,
        "owner_display": c.owner.display_name or c.owner.username if c.owner else "",
    } for c in chars])
