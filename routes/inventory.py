"""Inventory routes — view, scan, export, search."""
import json
import os

import httpx
from flask import Blueprint, request, jsonify, Response
from sqlalchemy import or_, func

from models import db, Character, Item, Inventory, Owner
from utils import get_current_owner, require_auth, match_item

inventory_bp = Blueprint("inventory", __name__)


def _build_scan_prompt() -> str:
    """
    Build scan prompt dynamically with all item names from DB.
    Claude receives the full list and must pick from it — eliminates OCR text errors.
    Falls back to generic prompt if DB is unavailable.
    """
    try:
        names = [i.name for i in Item.query.order_by(Item.category, Item.name).all()]
        names_str = "\n".join(f"- {n}" for n in names)
    except Exception:
        names_str = ""

    if names_str:
        return (
            "This is a Polish fantasy game inventory screenshot.\n"
            "Below is the COMPLETE list of all valid item names:\n"
            f"{names_str}\n\n"
            "Task: for each visible inventory slot, identify the item from the list above "
            "and read its quantity badge (small number in the top-left corner of the slot).\n"
            "Return ONLY a raw JSON array, no markdown, no explanation:\n"
            '[{"name":"exact name from the list above","quantity":number},...]\n'
            "Rules:\n"
            "1. ONLY use names EXACTLY as written in the list — never invent or modify names.\n"
            "2. Match by visual appearance — icon shape, color, and any readable text.\n"
            "3. If no quantity badge is visible, quantity is 1.\n"
            "4. Include ALL visible slots.\n"
            "5. If unsure between similar items, pick the closest visual match from the list."
        )
    else:
        return (
            "This is a game inventory screenshot in Polish. "
            "Extract every visible item and its quantity "
            "(the small number badge on the top-left corner of each slot). "
            "Return ONLY a raw JSON array, no markdown, no explanation: "
            '[{"name":"Polish item name","quantity":number},...]. '
            "Write the FULL Polish item name with correct diacritics (ą ę ó ś ż ź ć ń ł). "
            "If no badge is visible, quantity is 1. Include all visible sections."
        )


def _parse_id_list(raw: str | None) -> list[int]:
    if not raw:
        return []
    out = []
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return out


def _build_inventory_response(
    owner: Owner,
    *,
    category: str = "",
    tags: list[str] | None = None,
    character_ids: list[int] | None = None,
    only_with_data: bool = False,
    item_search: str = "",
) -> dict:
    # ── Characters ────────────────────────────────────────────────────────────
    char_q = Character.query
    if owner.role != "admin":
        char_q = char_q.filter_by(owner_id=owner.id)
    if character_ids:
        char_q = char_q.filter(Character.id.in_(character_ids))
    chars = char_q.order_by(Character.owner_id, Character.name).all()

    # ── Items ─────────────────────────────────────────────────────────────────
    item_q = Item.query
    if category:
        item_q = item_q.filter_by(category=category)
    if item_search:
        like = f"%{item_search.lower()}%"
        item_q = item_q.filter(func.lower(Item.name).like(like))
    items = item_q.order_by(
        Item.display_order.desc(), Item.category, Item.name
    ).all()

    if tags:
        items = [i for i in items if any(t in (i.tags or []) for t in tags)]

    char_ids = [c.id for c in chars]
    item_ids = [i.id for i in items]

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

    qty_map: dict[tuple[int, int], int] = {
        (e.character_id, e.item_id): e.quantity for e in entries
    }

    if only_with_data:
        items = [
            i for i in items
            if any(qty_map.get((c.id, i.id), 0) > 0 for c in chars)
        ]

    categories = sorted({i.category for i in items})

    return {
        "characters": [c.to_dict() for c in chars],
        "categories": categories,
        "items": [
            {
                "id": i.id,
                "name": i.name,
                "category": i.category,
                "tags": i.tags or [],
                "unit": i.unit,
                "quantities": {
                    str(c.id): qty_map.get((c.id, i.id), 0) for c in chars
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
    item_search = request.args.get("q", "").strip()
    tags_raw = request.args.get("tags", "").strip()
    chars_raw = request.args.get("characters", "").strip()
    only_with_data = request.args.get("only_with_data", "0") in ("1", "true", "True")
    scope = request.args.get("scope", "").strip()

    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else None
    character_ids = _parse_id_list(chars_raw) if chars_raw else None

    if scope == "mine" and owner.role == "admin":
        own_ids = [c.id for c in Character.query.filter_by(owner_id=owner.id).all()]
        if character_ids:
            character_ids = [c for c in character_ids if c in own_ids]
        else:
            character_ids = own_ids

    return jsonify(_build_inventory_response(
        owner,
        category=category,
        tags=tags,
        character_ids=character_ids,
        only_with_data=only_with_data,
        item_search=item_search,
    ))


@inventory_bp.route("/items/<int:item_id>/holders", methods=["GET"])
@require_auth
def item_holders(item_id):
    owner = get_current_owner()
    item = db.session.get(Item, item_id)
    if not item:
        return jsonify({"error": "Nie znaleziono surowca"}), 404

    q = (
        db.session.query(Inventory, Character, Owner)
        .join(Character, Inventory.character_id == Character.id)
        .join(Owner, Character.owner_id == Owner.id)
        .filter(Inventory.item_id == item_id)
        .filter(Inventory.quantity > 0)
        .order_by(Inventory.quantity.desc(), Character.name)
    )

    rows = q.all()
    return jsonify({
        "item": item.to_dict(),
        "holders": [
            {
                "character_id": char.id,
                "character_name": char.name,
                "owner_username": ownr.username,
                "owner_display": ownr.display_name or ownr.username,
                "quantity": inv.quantity,
            }
            for inv, char, ownr in rows
        ],
        "total": sum(inv.quantity for inv, _, _ in rows),
    })


@inventory_bp.route("/items/tags", methods=["GET"])
@require_auth
def all_tags():
    items = Item.query.with_entities(Item.tags).all()
    tag_set = set()
    for (tags,) in items:
        if tags:
            for t in tags:
                if isinstance(t, str) and t.strip():
                    tag_set.add(t.strip())
    return jsonify(sorted(tag_set))


@inventory_bp.route("/search", methods=["GET"])
@require_auth
def global_search():
    owner = get_current_owner()
    q = request.args.get("q", "").strip().lower()
    if len(q) < 2:
        return jsonify({"items": [], "characters": []})

    like = f"%{q}%"

    item_results = (
        Item.query
        .filter(func.lower(Item.name).like(like))
        .order_by(Item.display_order.desc(), Item.name)
        .limit(15)
        .all()
    )

    char_q = Character.query.filter(func.lower(Character.name).like(like))
    if owner.role != "admin":
        char_q = char_q.filter(Character.owner_id == owner.id)
    char_results = char_q.order_by(Character.name).limit(10).all()

    return jsonify({
        "items": [{"id": i.id, "name": i.name, "category": i.category, "tags": i.tags or []} for i in item_results],
        "characters": [
            {
                "id": c.id,
                "name": c.name,
                "owner_username": c.owner.username if c.owner else "",
            }
            for c in char_results
        ],
    })


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

    char = None
    if character_id:
        char = db.session.get(Character, int(character_id))
        if not char:
            return jsonify({"error": "Nie znaleziono postaci"}), 404
        if owner.role != "admin" and char.owner_id != owner.id:
            return jsonify({"error": "Brak uprawnień do tej postaci"}), 403

    # Build prompt dynamically with current item list from DB
    scan_prompt = _build_scan_prompt()

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
                    "max_tokens": 2048,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": mime,
                                    "data": data,
                                },
                            },
                            {"type": "text", "text": scan_prompt},
                        ],
                    }],
                },
                timeout=45,
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

    all_items = Item.query.all()
    matched: list[dict] = []
    unmatched: list[dict] = []
    matched_ids: set[int] = set()

    for raw_name, qty in raw_items.items():
        item = match_item(raw_name, all_items)
        if item:
            if item.id in matched_ids:
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

    if save and char:
        for m in matched:
            entry = Inventory.query.filter_by(
                character_id=char.id, item_id=m["item_id"]
            ).first()
            if entry:
                entry.quantity = m["quantity"]
            else:
                db.session.add(Inventory(
                    character_id=char.id,
                    item_id=m["item_id"],
                    quantity=m["quantity"],
                ))
        db.session.commit()

    return jsonify({"matched": matched, "unmatched": unmatched})


@inventory_bp.route("/export", methods=["GET"])
@require_auth
def export_csv():
    owner = get_current_owner()
    category = request.args.get("category", "").strip()
    chars_raw = request.args.get("characters", "").strip()
    character_ids = _parse_id_list(chars_raw) if chars_raw else None
    data = _build_inventory_response(owner, category=category, character_ids=character_ids)

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
