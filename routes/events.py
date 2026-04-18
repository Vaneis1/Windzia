"""Events routes — character events table + guild timeline."""
from flask import Blueprint, request, jsonify
from models import db, Event, Character, House
from utils import get_current_owner, require_auth

events_bp = Blueprint("events", __name__)

VALID_VISIBILITY = {"public", "house", "private"}


def _owner_house_ids(owner):
    """Return set of house IDs that the owner's characters belong to."""
    ids = set()
    for char in owner.characters:
        for h in char.houses:
            ids.add(h.id)
    return ids


def _can_see(event, owner, owner_house_ids):
    """Check if owner can see this event."""
    if owner.role == "admin":
        return True
    if event.character and event.character.owner_id == owner.id:
        return True  # own character — see everything
    if event.visibility == "public":
        return True
    if event.visibility == "house":
        char_house_ids = {h.id for h in (event.character.houses or [])}
        return bool(char_house_ids & owner_house_ids)
    return False  # private


# ── Per-character events (used by editor) ─────────────────────────────────────

@events_bp.route("/characters/<int:cid>/events", methods=["GET"])
def get_character_events(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404

    events = (
        Event.query
        .filter_by(character_id=cid)
        .order_by(Event.date, Event.id)
        .all()
    )

    # Try to get auth token to decide visibility
    from flask_jwt_extended import decode_token
    from flask_jwt_extended.exceptions import JWTDecodeError
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    owner = None
    if token:
        try:
            from models import Owner
            decoded = decode_token(token)
            identity = decoded.get("sub")
            owner = Owner.query.filter_by(username=identity).first() or db.session.get(Owner, identity)
        except Exception:
            pass

    is_owner = owner and (owner.role == "admin" or owner.id == char.owner_id)

    if is_owner:
        return jsonify([e.to_dict() for e in events])

    # Filter by visibility for non-owners
    owner_hids = _owner_house_ids(owner) if owner else set()
    char_house_ids = {h.id for h in char.houses}
    result = []
    for e in events:
        if e.visibility == "public":
            result.append(e.to_dict())
        elif e.visibility == "house" and owner:
            if char_house_ids & owner_hids:
                result.append(e.to_dict())
    return jsonify(result)


@events_bp.route("/characters/<int:cid>/events", methods=["PUT"])
@require_auth
def sync_character_events(cid):
    """Replace all events for a character (batch save from editor)."""
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    events_data = body.get("events", [])

    if not isinstance(events_data, list):
        return jsonify({"error": "events musi być tablicą"}), 400
    if len(events_data) > 200:
        return jsonify({"error": "Za dużo wydarzeń (max 200)"}), 400

    # Replace all events
    Event.query.filter_by(character_id=cid).delete()

    for e in events_data:
        if not isinstance(e, dict):
            continue
        title = str(e.get("title", "")).strip()
        if not title:
            continue
        vis = e.get("visibility", "public")
        if vis not in VALID_VISIBILITY:
            vis = "public"
        event = Event(
            character_id=cid,
            date=str(e.get("date", ""))[:10] or None,
            title=title[:200],
            description=str(e.get("description", ""))[:5000] or None,
            visibility=vis,
        )
        db.session.add(event)

    db.session.commit()
    return jsonify({"ok": True})


# ── Guild timeline ─────────────────────────────────────────────────────────────

@events_bp.route("/events", methods=["GET"])
@require_auth
def get_timeline_events():
    """Guild timeline — filtered by character, house, date range, visibility."""
    owner = get_current_owner()
    owner_hids = _owner_house_ids(owner)

    # Query params
    char_id  = request.args.get("character_id", type=int)
    house_id = request.args.get("house_id",     type=int)
    date_from = request.args.get("date_from", "")
    date_to   = request.args.get("date_to",   "")

    query = Event.query
    if char_id:
        query = query.filter(Event.character_id == char_id)
    if date_from:
        query = query.filter(Event.date >= date_from)
    if date_to:
        query = query.filter(Event.date <= date_to)

    events = query.order_by(Event.date, Event.id).all()

    result = []
    for e in events:
        if not e.character:
            continue

        # House filter (filter by house membership of the character)
        if house_id:
            char_hids = {h.id for h in e.character.houses}
            if house_id not in char_hids:
                continue

        # Visibility
        if not _can_see(e, owner, owner_hids):
            continue

        result.append(e.to_dict(include_char=True))

    return jsonify(result)
