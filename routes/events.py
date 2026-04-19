"""Events routes — character events + guild timeline with tagging."""
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import selectinload

from models import db, Event, EventParticipant, Character
from utils import get_current_owner, require_auth

events_bp = Blueprint("events", __name__)

VALID_VISIBILITY = {"public", "house", "personal"}
MAX_PARTICIPANTS = 10
MAX_EVENTS = 200


# ── Helpers ───────────────────────────────────────────────────────────────────

def _try_get_owner():
    """Return current owner without raising if unauthenticated."""
    try:
        return get_current_owner()
    except Exception:
        return None


def _owner_house_ids(owner):
    ids = set()
    for c in (owner.characters or []):
        for h in (c.houses or []):
            ids.add(h.id)
    return ids


def _visible_on_timeline(event, char_filter_id, house_filter_id):
    """
    Visibility hierarchy for guild timeline:
      public   → always visible (no filter needed)
      house    → visible only with house filter matching the event's character
      personal → visible only with character filter matching owner or participant
    Additional char/house filters further narrow results.
    """
    vis = event.visibility
    char = event.character
    if not char:
        return False

    # All related character IDs (owner + non-dismissed participants)
    related_ids = {event.character_id}
    for p in event.participants:
        if not p.dismissed:
            related_ids.add(p.character_id)

    if vis == "public":
        if char_filter_id and char_filter_id not in related_ids:
            return False
        if house_filter_id:
            char_house_ids = {h.id for h in char.houses}
            if house_filter_id not in char_house_ids:
                return False
        return True

    elif vis == "house":
        # Requires a filter to be visible
        if char_filter_id:
            return char_filter_id in related_ids
        if house_filter_id:
            char_house_ids = {h.id for h in char.houses}
            return house_filter_id in char_house_ids
        return False

    elif vis == "personal":
        # Only visible when filtering by a related character
        if char_filter_id:
            return char_filter_id in related_ids
        return False

    return False


def _upsert_participants(event_obj, new_participant_ids, owner_char_id):
    """Sync participants for an event, preserving dismissed status."""
    new_set = set(new_participant_ids) - {owner_char_id}  # can't tag yourself
    existing = {p.character_id: p for p in event_obj.participants}

    # Add new participants
    for cid in new_set:
        if cid not in existing:
            db.session.add(EventParticipant(
                event_id=event_obj.id,
                character_id=cid,
                dismissed=False,
            ))

    # Remove participants no longer in the list (only non-dismissed ones)
    for cid, p in existing.items():
        if cid not in new_set and not p.dismissed:
            db.session.delete(p)


# ── Per-character events (editor + profile) ───────────────────────────────────

@events_bp.route("/characters/<int:cid>/events", methods=["GET"])
def get_character_events(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404

    owner = _try_get_owner()
    is_owner = owner and (owner.role == "admin" or owner.id == char.owner_id)
    owner_house_ids = _owner_house_ids(owner) if owner else set()
    char_house_ids = {h.id for h in char.houses}

    # 1. Own events (all, with participants)
    own_events = (
        Event.query
        .filter_by(character_id=cid)
        .options(
            selectinload(Event.participants)
            .selectinload(EventParticipant.participant_char)
        )
        .order_by(Event.date, Event.id)
        .all()
    )

    # 2. Shared events (char is a non-dismissed participant)
    shared_ids_q = (
        db.session.query(EventParticipant.event_id)
        .filter(
            EventParticipant.character_id == cid,
            EventParticipant.dismissed.is_(False),
        )
        .subquery()
    )
    shared_events = (
        Event.query
        .filter(Event.id.in_(shared_ids_q), Event.character_id != cid)
        .options(
            selectinload(Event.participants)
            .selectinload(EventParticipant.participant_char),
            selectinload(Event.character)
            .selectinload(Character.houses),
        )
        .order_by(Event.date, Event.id)
        .all()
    )

    result = []

    for e in own_events:
        d = e.to_dict(include_char=False)
        d["is_shared"] = False
        result.append(d)

    for e in shared_events:
        # Visibility filter for non-owners
        if not is_owner:
            vis = e.visibility
            if vis == "personal":
                continue  # personal events from others never shown on profile
            if vis == "house":
                e_house_ids = {h.id for h in (e.character.houses or [])}
                if not (char_house_ids & e_house_ids):
                    continue
        d = e.to_dict(include_char=True)
        d["is_shared"] = True
        result.append(d)

    result.sort(key=lambda x: (x.get("date") or ""))
    return jsonify(result)


@events_bp.route("/characters/<int:cid>/events", methods=["PUT"])
@require_auth
def sync_character_events(cid):
    """Upsert all own events for a character (called from editor save)."""
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
    if len(events_data) > MAX_EVENTS:
        return jsonify({"error": f"Za dużo wydarzeń (max {MAX_EVENTS})"}), 400

    # Load existing own events indexed by external_id (for upsert)
    existing_by_ext = {}
    events_without_ext = []
    for e in (
        Event.query
        .filter_by(character_id=cid)
        .options(selectinload(Event.participants))
        .all()
    ):
        if e.external_id:
            existing_by_ext[e.external_id] = e
        else:
            events_without_ext.append(e)

    # Delete old-format events (no external_id) — cleanup migration
    for e in events_without_ext:
        db.session.delete(e)

    incoming_ext_ids = set()

    for event_data in events_data:
        if not isinstance(event_data, dict):
            continue

        ext_id = str(event_data.get("id", ""))[:30] or None
        title = str(event_data.get("title", "")).strip()[:200]
        if not title:
            continue

        vis = event_data.get("visibility", "public")
        if vis not in VALID_VISIBILITY:
            vis = "public"

        date_val = str(event_data.get("date", ""))[:10] or None
        desc_val = str(event_data.get("description", ""))[:5000] or None

        raw_pids = event_data.get("participant_ids", [])
        participant_ids = []
        for pid in raw_pids:
            try:
                pid_int = int(pid)
                if pid_int != cid:
                    participant_ids.append(pid_int)
            except (ValueError, TypeError):
                pass
        participant_ids = participant_ids[:MAX_PARTICIPANTS]

        if ext_id:
            incoming_ext_ids.add(ext_id)

        if ext_id and ext_id in existing_by_ext:
            # Update existing event
            e = existing_by_ext[ext_id]
            e.date = date_val
            e.title = title
            e.description = desc_val
            e.visibility = vis
        else:
            # Create new event
            e = Event(
                character_id=cid,
                external_id=ext_id,
                date=date_val,
                title=title,
                description=desc_val,
                visibility=vis,
            )
            db.session.add(e)
            db.session.flush()  # get e.id

        _upsert_participants(e, participant_ids, cid)

    # Delete events no longer in the incoming list
    for ext_id, e in existing_by_ext.items():
        if ext_id not in incoming_ext_ids:
            db.session.delete(e)

    db.session.commit()
    return jsonify({"ok": True})


# ── Dismiss (tagged character removes event from their profile) ────────────────

@events_bp.route("/events/<int:eid>/participants/<int:cid>", methods=["DELETE"])
@require_auth
def dismiss_participant(eid, cid):
    """Tagged character's owner dismisses the event from their profile."""
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    participant = db.session.get(EventParticipant, (eid, cid))
    if not participant:
        return jsonify({"error": "Nie znaleziono powiązania"}), 404

    participant.dismissed = True
    db.session.commit()
    return jsonify({"ok": True})


# ── Guild timeline ─────────────────────────────────────────────────────────────

@events_bp.route("/events", methods=["GET"])
@require_auth
def get_timeline_events():
    """
    Guild timeline with visibility hierarchy:
      public   → always visible
      house    → only with house_id filter
      personal → only with character_id filter (owner or tagged)
    """
    char_filter_id = request.args.get("character_id", type=int)
    house_filter_id = request.args.get("house_id", type=int)
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    query = Event.query.options(
        selectinload(Event.participants)
        .selectinload(EventParticipant.participant_char),
        selectinload(Event.character)
        .selectinload(Character.houses),
    )

    if char_filter_id:
        # Events where char is owner OR non-dismissed participant
        from sqlalchemy import or_
        participant_sub = (
            db.session.query(EventParticipant.event_id)
            .filter(
                EventParticipant.character_id == char_filter_id,
                EventParticipant.dismissed.is_(False),
            )
            .subquery()
        )
        query = query.filter(
            or_(
                Event.character_id == char_filter_id,
                Event.id.in_(participant_sub),
            )
        )

    if date_from:
        query = query.filter(Event.date >= date_from)
    if date_to:
        query = query.filter(Event.date <= date_to)

    events = query.order_by(Event.date, Event.id).all()

    result = []
    for e in events:
        if not _visible_on_timeline(e, char_filter_id, house_filter_id):
            continue
        result.append(e.to_dict(include_char=True))

    return jsonify(result)
