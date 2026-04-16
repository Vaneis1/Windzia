import json
import os
 
import httpx
from flask import Blueprint, request, jsonify, Response
 
from models import db, Character, Item, Inventory
from utils import get_current_owner, require_auth, match_item
 
inventory_bp = Blueprint("inventory", __name__)
 
SCAN_PROMPT = (
    "This is a game inventory screenshot in Polish. "
    "Extract every visible item and its quantity "
    "(the small number badge on the top-left corner of each slot). "
    "Return ONLY a raw JSON array, no markdown, no explanation: "
    '[{"name":"Polish item name","quantity":number},...]. '
    "If no badge is visible, quantity is 1. Include all visible sections."
)
 
 
def _build_inventory_response(owner, category: str = "") -> dict:
    """Build the full inventory grid for current user."""
    if owner.role == "admin":
        chars = Character.query.order_by(Character.owner_id, Character.name).all()
    else:
        chars = (
            Character.query
            .filter_by(owner_id=owner.id)
            .order_by(Character.name)
            .all()
        )
 
    item_q = Item.query
    if category:
        item_q = item_q.filter_by(category=category)
    items = item_q.order_by(Item.category, Item.name).all()
 
    char_ids = [c.id for c in chars]
    item_ids = [i.id for i in items]
 
    # Single query for all relevant inventory entries
    entries = []
    if char_ids and item_ids:
        entries = (
            Inventory.query
            .filter(
                Inventory.character_id.in_(char_ids),
                Inventory.item_id.in_(item_ids),
            )
            .all()
        )
 
    qty_map = {(e.character_id, e.item_id): e.quantity for e in entries}
    categories = sorted({i.category for i in items})
 
    return {
        "characters": [c.to_dict() for c in chars],
        "categories": categories,
        "items": [
            {
                "id": i.id,
                "name": i.name,
                "category": i.category,
                "quantities": {
                    str(c.id): qty_map.get((c.id, i.id), 0)
                    for c in chars
                },
            }
            for i in items
        ],
    }
 
 
@inventory_bp.route("/inventory", methods=["GET"])
@require_auth
def get_inventory():
    owner = get_current_owner()
    category = request.args.get("category", "").strip()
    return jsonify(_build_inventory_response(owner, category))
 
 
@inventory_bp.route("/scan", methods=["POST"])
@require_auth
def scan():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return jsonify({"error": "Brak klucza API na serwerze"}), 500
 
    owner = get_current_owner()
    body = request.get_json(silent=True) or {}
    images = body.get("images", [])
    character_id = body.get("character_id")
    save = body.get("save", False)
 
    if not images:
        return jsonify({"error": "Brak obrazów do skanowania"}), 400
 
    # Validate character access
    char = None
    if character_id:
        char = db.session.get(Character, int(character_id))
        if not char:
            return jsonify({"error": "Nie znaleziono postaci"}), 404
        if owner.role != "admin" and char.owner_id != owner.id:
            return jsonify({"error": "Brak uprawnień do tej postaci"}), 403
 
    # Scan all images via Anthropic API
    raw_items: dict[str, int] = {}
    for img in images:
        mime = img.get("mime_type", "image/png")
        data = img.get("data", "")
        if not data:
            continue
 
        try:
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 1500,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "image", "source": {"type": "base64", "media_type": mime, "data": data}},
                                {"type": "text", "text": SCAN_PROMPT},
                            ],
                        }
                    ],
                },
                timeout=30,
            )
            resp_data = response.json()
            if "error" in resp_data:
                return jsonify({"error": resp_data["error"]["message"]}), 500
 
            raw_text = (
                "".join(b.get("text", "") for b in resp_data.get("content", []))
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )
            parsed = json.loads(raw_text)
            for entry in parsed:
                name = entry.get("name", "").strip()
                qty = int(entry.get("quantity", 1))
                if name:
                    raw_items[name] = raw_items.get(name, 0) + qty
 
        except (httpx.RequestError, json.JSONDecodeError, ValueError) as e:
            return jsonify({"error": f"Błąd skanowania: {str(e)}"}), 500
 
    # Match raw names to DB items (load all items once)
    all_items = Item.query.all()
    matched: list[dict] = []
    unmatched: list[dict] = []
    matched_ids: set[int] = set()
 
    for raw_name, qty in raw_items.items():
        item = match_item(raw_name, all_items)
        if item:
            if item.id in matched_ids:
                # Merge duplicate matches
                for m in matched:
                    if m["item_id"] == item.id:
                        m["quantity"] += qty
                        break
            else:
                matched_ids.add(item.id)
                matched.append({
                    "item_id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "raw_name": raw_name,
                    "quantity": qty,
                })
        else:
            unmatched.append({"raw_name": raw_name, "quantity": qty})
 
    # Save to DB if requested
    if save and char:
        for m in matched:
            entry = Inventory.query.filter_by(
                character_id=char.id, item_id=m["item_id"]
            ).first()
            if entry:
                entry.quantity = m["quantity"]
            else:
                db.session.add(
                    Inventory(
                        character_id=char.id,
                        item_id=m["item_id"],
                        quantity=m["quantity"],
                    )
                )
        db.session.commit()
 
    return jsonify({"matched": matched, "unmatched": unmatched})
 
 
@inventory_bp.route("/export", methods=["GET"])
@require_auth
def export_csv():
    owner = get_current_owner()
    category = request.args.get("category", "").strip()
    data = _build_inventory_response(owner, category)
 
    chars = data["characters"]
    items = data["items"]
 
    lines = ["Kategoria,Przedmiot," + ",".join(f'"{c["name"]}"' for c in chars)]
    for item in items:
        row = [
            f'"{item["category"]}"',
            f'"{item["name"]}"',
        ] + [str(item["quantities"].get(str(c["id"]), "")) for c in chars]
        lines.append(",".join(row))
 
    return Response(
        "\n".join(lines),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment;filename=inwentarz.csv"},
    )
