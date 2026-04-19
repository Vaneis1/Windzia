"""Events routes — character events + guild timeline."""
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import selectinload

from models import db, Event, EventParticipant, Character
from utils import get_current_owner, require_auth

events_bp = Blueprint("events", __name__)

VALID_VISIBILITY = {"public", "house", "personal"}
MAX_PARTICIPANTS = 10
MAX_EVENTS = 200


def _try_get_owner():
    try:
        return get_current_owner()
    except Exception:
        return None


def _upsert_participants(event_obj, new_participant_ids, owner_char_id):
    new_set = set(new_participant_ids) - {owner_char_id}
    existing = {p.character_id: p for p in event_obj.participants}

    for cid in new_set:
        if cid not in existing:
            db.session.add(EventParticipant(
                event_id=event_obj.id,
                character_id=cid,
                dismissed=False,
            ))

    for cid, p in existing.items():
        if cid not in new_set and not p.dismissed:
            db.session.delete(p)


# ── Per-character events ───────────────────────────────────────────────────────

@events_bp.route("/characters/<int:cid>/events", methods=["GET"])
def get_character_events(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404

    owner = _try_get_owner()
    is_owner = owner and (owner.role == "admin" or owner.id == char.owner_id)

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

    owner_hids = set()
    if owner:
        for c in owner.characters:
            for h in c.houses:
                owner_hids.add(h.id)

    char_house_ids = {h.id for h in char.houses}

    for e in shared_events:
        if not is_owner:
            vis = e.visibility
            if vis == "personal":
                continue
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
        cat_val = str(event_data.get("category", ""))[:50] or None

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
            e = existing_by_ext[ext_id]
            e.date = date_val
            e.title = title
            e.description = desc_val
            e.visibility = vis
            e.category = cat_val
        else:
            e = Event(
                character_id=cid,
                external_id=ext_id,
                date=date_val,
                title=title,
                description=desc_val,
                visibility=vis,
                category=cat_val,
            )
            db.session.add(e)
            db.session.flush()

        _upsert_participants(e, participant_ids, cid)

    for ext_id, e in existing_by_ext.items():
        if ext_id not in incoming_ext_ids:
            db.session.delete(e)

    db.session.commit()
    return jsonify({"ok": True})


# ── Dismiss ────────────────────────────────────────────────────────────────────

@events_bp.route("/events/<int:eid>/participants/<int:cid>", methods=["DELETE"])
@require_auth
def dismiss_participant(eid, cid):
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


# ── Guild timeline — zwraca WSZYSTKIE wydarzenia, filtry tylko zawężają ────────

@events_bp.route("/events", methods=["GET"])
@require_auth
def get_timeline_events():
    char_filter_id = request.args.get("character_id", type=int)
    house_filter_id = request.args.get("house_id", type=int)
    category_filter = request.args.get("category", "").strip()
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    query = Event.query.options(
        selectinload(Event.participants)
        .selectinload(EventParticipant.participant_char),
        selectinload(Event.character)
        .selectinload(Character.houses),
    )

    if char_filter_id:
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

    if house_filter_id:
        from sqlalchemy import exists
        char_in_house = (
            db.session.query(Character.id)
            .join(Character.houses)
            .filter(db.text(f"houses.id = {house_filter_id}"))
            .subquery()
        )
        query = query.filter(Event.character_id.in_(char_in_house))

    if category_filter:
        query = query.filter(Event.category == category_filter)

    if date_from:
        query = query.filter(Event.date >= date_from)
    if date_to:
        query = query.filter(Event.date <= date_to)

    events = query.order_by(Event.date, Event.id).all()

    result = []
    for e in events:
        if not e.character:
            continue
        result.append(e.to_dict(include_char=True))

    return jsonify(result)


# ── Categories list ────────────────────────────────────────────────────────────

@events_bp.route("/events/categories", methods=["GET"])
@require_auth
def get_event_categories():
    """Return all distinct categories used in events."""
    from models import EVENT_CATEGORIES
    # Get custom categories from DB too
    rows = db.session.query(Event.category).filter(
        Event.category.isnot(None),
        Event.category != "",
    ).distinct().all()
    db_cats = {r[0] for r in rows if r[0]}
    # Merge predefined + custom, predefined first
    all_cats = list(EVENT_CATEGORIES)
    for c in sorted(db_cats):
        if c not in all_cats:
            all_cats.append(c)
    return jsonify(all_cats)
