from flask import Blueprint, request, jsonify
from models import db, Item
from utils import require_auth, require_role

items_bp = Blueprint("items", __name__)


@items_bp.route("/items", methods=["GET"])
@require_auth
def get_items():
    category = request.args.get("category", "").strip()
    q = Item.query
    if category:
        q = q.filter_by(category=category)
    items = q.order_by(Item.category, Item.name).all()
    return jsonify([i.to_dict() for i in items])


@items_bp.route("/items/categories", methods=["GET"])
@require_auth
def get_categories():
    rows = (
        db.session.query(Item.category)
        .distinct()
        .order_by(Item.category)
        .all()
    )
    return jsonify([r[0] for r in rows])


@items_bp.route("/items", methods=["POST"])
@require_role("admin")
def add_item():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()
    category = body.get("category", "").strip().upper()

    if not name or not category:
        return jsonify({"error": "Nazwa i kategoria są wymagane"}), 400
    if len(name) > 200:
        return jsonify({"error": "Nazwa jest za długa"}), 400

    if Item.query.filter_by(name=name).first():
        return jsonify({"error": "Przedmiot o tej nazwie już istnieje"}), 409

    aliases = [a.strip() for a in body.get("aliases", []) if a.strip()]
    tags = [t.strip() for t in body.get("tags", []) if isinstance(t, str) and t.strip()]
    item = Item(
        name=name,
        category=category,
        aliases=aliases,
        tags=tags,
        display_order=int(body.get("display_order", 0) or 0),
        unit=(body.get("unit") or "").strip() or None,
        meta=body.get("meta", {}),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@items_bp.route("/items/<int:iid>", methods=["PUT"])
@require_role("admin")
def update_item(iid):
    item = db.session.get(Item, iid)
    if not item:
        return jsonify({"error": "Nie znaleziono przedmiotu"}), 404

    body = request.get_json(silent=True) or {}
    if "name" in body:
        new_name = body["name"].strip()
        if not new_name:
            return jsonify({"error": "Nazwa nie może być pusta"}), 400
        existing = Item.query.filter(Item.name == new_name, Item.id != iid).first()
        if existing:
            return jsonify({"error": "Przedmiot o tej nazwie już istnieje"}), 409
        item.name = new_name
    if "category" in body:
        item.category = body["category"].strip().upper()
    if "aliases" in body:
        item.aliases = [a.strip() for a in body["aliases"] if a.strip()]
    if "tags" in body:
        item.tags = [t.strip() for t in body["tags"] if isinstance(t, str) and t.strip()]
    if "display_order" in body:
        try:
            item.display_order = int(body["display_order"] or 0)
        except (ValueError, TypeError):
            return jsonify({"error": "display_order musi być liczbą"}), 400
    if "unit" in body:
        item.unit = (body.get("unit") or "").strip() or None
    if "meta" in body:
        item.meta = body["meta"]

    db.session.commit()
    return jsonify(item.to_dict())


@items_bp.route("/items/<int:iid>", methods=["DELETE"])
@require_role("admin")
def delete_item(iid):
    item = db.session.get(Item, iid)
    if not item:
        return jsonify({"error": "Nie znaleziono przedmiotu"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})
