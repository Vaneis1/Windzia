from flask import Blueprint, request, jsonify
from models import db, Owner, Character, Inventory
from utils import hash_password, require_role, get_current_owner

admin_bp = Blueprint("admin", __name__)


# ── Owner management ──────────────────────────────────────────────────────────

@admin_bp.route("/owners", methods=["GET"])
@require_role("admin")
def list_owners():
    owners = Owner.query.order_by(Owner.created_at).all()
    return jsonify([o.to_dict() for o in owners])


@admin_bp.route("/owners", methods=["POST"])
@require_role("admin")
def create_owner():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    email = body.get("email", "").lower().strip()
    password = body.get("password", "")
    role = body.get("role", "owner")

    if not username or not email or not password:
        return jsonify({"error": "Wypełnij wszystkie pola"}), 400
    if len(password) < 6:
        return jsonify({"error": "Hasło musi mieć minimum 6 znaków"}), 400
    if role not in ("owner", "admin"):
        return jsonify({"error": "Nieprawidłowa rola"}), 400
    if Owner.query.filter_by(email=email).first():
        return jsonify({"error": "Email jest już zajęty"}), 409
    if Owner.query.filter_by(username=username).first():
        return jsonify({"error": "Nazwa użytkownika jest już zajęta"}), 409

    owner = Owner(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=role,
    )
    db.session.add(owner)
    db.session.commit()
    return jsonify(owner.to_dict()), 201


@admin_bp.route("/owners/<int:oid>", methods=["DELETE"])
@require_role("admin")
def delete_owner(oid):
    current = get_current_owner()
    if current.id == oid:
        return jsonify({"error": "Nie możesz usunąć własnego konta"}), 400
    owner = db.session.get(Owner, oid)
    if not owner:
        return jsonify({"error": "Nie znaleziono użytkownika"}), 404
    db.session.delete(owner)
    db.session.commit()
    return jsonify({"ok": True})


@admin_bp.route("/owners/<int:oid>/reset-password", methods=["PUT"])
@require_role("admin")
def reset_owner_password(oid):
    owner = db.session.get(Owner, oid)
    if not owner:
        return jsonify({"error": "Nie znaleziono użytkownika"}), 404
    body = request.get_json(silent=True) or {}
    new_pwd = body.get("password", "")
    if len(new_pwd) < 6:
        return jsonify({"error": "Hasło musi mieć minimum 6 znaków"}), 400
    owner.password_hash = hash_password(new_pwd)
    db.session.commit()
    return jsonify({"ok": True})


# ── Character management ──────────────────────────────────────────────────────

@admin_bp.route("/characters/<int:cid>", methods=["PUT"])
@require_role("admin")
def update_character(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    body = request.get_json(silent=True) or {}
    if "name" in body:
        char.name = body["name"].strip()
    if "owner_id" in body:
        char.owner_id = int(body["owner_id"])
    db.session.commit()
    return jsonify(char.to_dict())


@admin_bp.route("/characters/<int:cid>", methods=["DELETE"])
@require_role("admin")
def delete_character(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    db.session.delete(char)
    db.session.commit()
    return jsonify({"ok": True})


# ── Inventory management ──────────────────────────────────────────────────────

@admin_bp.route("/inventory/<int:cid>/<int:item_id>", methods=["PUT"])
@require_role("admin")
def update_inventory_entry(cid, item_id):
    body = request.get_json(silent=True) or {}
    try:
        qty = int(body.get("quantity", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Nieprawidłowa ilość"}), 400

    entry = Inventory.query.filter_by(character_id=cid, item_id=item_id).first()
    if entry:
        entry.quantity = qty
    else:
        db.session.add(Inventory(character_id=cid, item_id=item_id, quantity=qty))
    db.session.commit()
    return jsonify({"ok": True})


@admin_bp.route("/inventory/<int:cid>/<int:item_id>", methods=["DELETE"])
@require_role("admin")
def delete_inventory_entry(cid, item_id):
    entry = Inventory.query.filter_by(character_id=cid, item_id=item_id).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
    return jsonify({"ok": True})


@admin_bp.route("/inventory/<int:cid>", methods=["DELETE"])
@require_role("admin")
def clear_character_inventory(cid):
    Inventory.query.filter_by(character_id=cid).delete()
    db.session.commit()
    return jsonify({"ok": True})
