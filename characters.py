from flask import Blueprint, request, jsonify
from models import db, Character
from utils import get_current_owner, require_auth

characters_bp = Blueprint("characters", __name__)


@characters_bp.route("/characters", methods=["GET"])
@require_auth
def get_characters():
    owner = get_current_owner()
    if owner.role == "admin":
        chars = (
            Character.query
            .order_by(Character.owner_id, Character.name)
            .all()
        )
    else:
        chars = (
            Character.query
            .filter_by(owner_id=owner.id)
            .order_by(Character.name)
            .all()
        )
    return jsonify([c.to_dict() for c in chars])


@characters_bp.route("/characters", methods=["POST"])
@require_auth
def add_character():
    owner = get_current_owner()
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()

    if not name:
        return jsonify({"error": "Nazwa postaci jest wymagana"}), 400
    if len(name) > 100:
        return jsonify({"error": "Nazwa jest za długa (max 100 znaków)"}), 400

    # Admin can assign to any owner; regular user assigns to self
    if owner.role == "admin" and "owner_id" in body:
        owner_id = int(body["owner_id"])
    else:
        owner_id = owner.id

    char = Character(name=name, owner_id=owner_id)
    db.session.add(char)
    db.session.commit()
    return jsonify(char.to_dict()), 201


@characters_bp.route("/characters/<int:cid>", methods=["DELETE"])
@require_auth
def delete_character(cid):
    owner = get_current_owner()
    char = db.session.get(Character, cid)

    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień do tej postaci"}), 403

    db.session.delete(char)
    db.session.commit()
    return jsonify({"ok": True})
