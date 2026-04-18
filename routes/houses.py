from flask import Blueprint, request, jsonify
from models import db, House, Character
from utils import get_current_owner, require_auth

houses_bp = Blueprint("houses", __name__)


@houses_bp.route("/houses", methods=["GET"])
@require_auth
def get_houses():
    houses = House.query.order_by(House.name).all()
    return jsonify([h.to_dict() for h in houses])


@houses_bp.route("/houses", methods=["POST"])
@require_auth
def create_house():
    owner = get_current_owner()
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()

    if not name:
        return jsonify({"error": "Nazwa rodu jest wymagana"}), 400
    if len(name) > 100:
        return jsonify({"error": "Nazwa za długa (max 100 znaków)"}), 400
    if House.query.filter_by(name=name).first():
        return jsonify({"error": "Ród o tej nazwie już istnieje"}), 409

    house = House(
        name=name,
        color=body.get("color", "#c9a45c"),
        description=body.get("description", "").strip() or None,
        heraldry=body.get("heraldry", "").strip() or None,
        created_by=owner.id,
    )
    db.session.add(house)
    db.session.commit()
    return jsonify(house.to_dict()), 201


@houses_bp.route("/houses/<int:hid>", methods=["PUT"])
@require_auth
def update_house(hid):
    owner = get_current_owner()
    house = db.session.get(House, hid)
    if not house:
        return jsonify({"error": "Nie znaleziono rodu"}), 404
    if owner.role != "admin" and house.created_by != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    if "name" in body:
        name = body["name"].strip()
        if not name:
            return jsonify({"error": "Nazwa nie może być pusta"}), 400
        existing = House.query.filter_by(name=name).first()
        if existing and existing.id != hid:
            return jsonify({"error": "Ród o tej nazwie już istnieje"}), 409
        house.name = name
    if "color" in body:
        house.color = body["color"]
    if "description" in body:
        house.description = body["description"].strip() or None
    if "heraldry" in body:
        house.heraldry = body["heraldry"].strip() or None

    db.session.commit()
    return jsonify(house.to_dict())


@houses_bp.route("/houses/<int:hid>", methods=["DELETE"])
@require_auth
def delete_house(hid):
    owner = get_current_owner()
    house = db.session.get(House, hid)
    if not house:
        return jsonify({"error": "Nie znaleziono rodu"}), 404
    if owner.role != "admin" and house.created_by != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    db.session.delete(house)
    db.session.commit()
    return jsonify({"ok": True})


@houses_bp.route("/characters/<int:cid>/houses", methods=["PUT"])
@require_auth
def set_character_houses(cid):
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    house_ids = body.get("house_ids", [])
    if len(house_ids) > 2:
        return jsonify({"error": "Postać może należeć do maksymalnie 2 rodów"}), 400

    houses = House.query.filter(House.id.in_(house_ids)).all() if house_ids else []
    char.houses = houses
    db.session.commit()
    return jsonify({"ok": True, "houses": [h.to_dict() for h in houses]})
