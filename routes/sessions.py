"""Sessions routes — campaigns and sessions CRUD."""
from flask import Blueprint, request, jsonify

from models import (
    db, Campaign, Session, SessionParticipant, Character,
    VALID_SESSION_STATUSES, VALID_SESSION_RISKS, VALID_SESSION_SCOPES,
)
from utils import get_current_owner, require_auth

sessions_bp = Blueprint("sessions", __name__)


def _can_edit_session(owner, session_obj):
    """Creator or admin can edit/delete a session."""
    return owner.role == "admin" or session_obj.created_by == owner.id


# ── Campaigns ─────────────────────────────────────────────────────────────────

@sessions_bp.route("/campaigns", methods=["GET"])
@require_auth
def list_campaigns():
    campaigns = Campaign.query.order_by(Campaign.name).all()
    return jsonify([c.to_dict() for c in campaigns])


@sessions_bp.route("/campaigns", methods=["POST"])
@require_auth
def create_campaign():
    owner = get_current_owner()
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()[:200]
    if not name:
        return jsonify({"error": "Podaj nazwę kampanii"}), 400

    c = Campaign(
        name=name,
        description=str(body.get("description", "")).strip()[:2000] or None,
        status=body.get("status", "active") if body.get("status") in ("active", "ended") else "active",
        created_by=owner.id,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@sessions_bp.route("/campaigns/<int:cid>", methods=["PUT"])
@require_auth
def update_campaign(cid):
    owner = get_current_owner()
    c = db.session.get(Campaign, cid)
    if not c:
        return jsonify({"error": "Nie znaleziono kampanii"}), 404
    if owner.role != "admin" and c.created_by != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    if "name" in body:
        c.name = str(body["name"]).strip()[:200] or c.name
    if "description" in body:
        c.description = str(body["description"]).strip()[:2000] or None
    if body.get("status") in ("active", "ended"):
        c.status = body["status"]
    db.session.commit()
    return jsonify(c.to_dict())


@sessions_bp.route("/campaigns/<int:cid>", methods=["DELETE"])
@require_auth
def delete_campaign(cid):
    owner = get_current_owner()
    c = db.session.get(Campaign, cid)
    if not c:
        return jsonify({"error": "Nie znaleziono kampanii"}), 404
    if owner.role != "admin" and c.created_by != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})


# ── Sessions ──────────────────────────────────────────────────────────────────

@sessions_bp.route("/sessions", methods=["GET"])
@require_auth
def list_sessions():
    campaign_id = request.args.get("campaign_id", type=int)
    status = request.args.get("status", "").strip()

    q = Session.query
    if campaign_id:
        q = q.filter_by(campaign_id=campaign_id)
    if status in VALID_SESSION_STATUSES:
        q = q.filter_by(status=status)

    sessions = q.order_by(Session.date_start.desc().nullslast(), Session.id.desc()).all()
    return jsonify([s.to_dict() for s in sessions])


@sessions_bp.route("/sessions", methods=["POST"])
@require_auth
def create_session():
    owner = get_current_owner()
    body = request.get_json(silent=True) or {}

    title = str(body.get("title", "")).strip()[:200]
    if not title:
        return jsonify({"error": "Podaj tytuł sesji"}), 400

    # Optionally create a new campaign inline
    campaign_id = body.get("campaign_id")
    new_campaign_name = str(body.get("new_campaign_name", "")).strip()[:200]
    if new_campaign_name and not campaign_id:
        camp = Campaign(name=new_campaign_name, created_by=owner.id)
        db.session.add(camp)
        db.session.flush()
        campaign_id = camp.id

    if campaign_id and not db.session.get(Campaign, campaign_id):
        return jsonify({"error": "Nie znaleziono kampanii"}), 404

    status = body.get("status", "recruiting")
    risk   = body.get("risk",   "low")
    scope  = body.get("scope",  "local")
    if status not in VALID_SESSION_STATUSES: status = "recruiting"
    if risk   not in VALID_SESSION_RISKS:    risk   = "low"
    if scope  not in VALID_SESSION_SCOPES:   scope  = "local"

    s = Session(
        campaign_id = campaign_id,
        title       = title,
        description = str(body.get("description", "")).strip()[:5000] or None,
        date_start  = str(body.get("date_start", ""))[:10] or None,
        date_end    = str(body.get("date_end",   ""))[:10] or None,
        status      = status,
        risk        = risk,
        scope       = scope,
        created_by  = owner.id,
    )
    db.session.add(s)
    db.session.flush()

    _sync_participants(s, body.get("character_ids", []), body.get("npc_names", []))
    db.session.commit()
    return jsonify(s.to_dict()), 201


@sessions_bp.route("/sessions/<int:sid>", methods=["PUT"])
@require_auth
def update_session(sid):
    owner = get_current_owner()
    s = db.session.get(Session, sid)
    if not s:
        return jsonify({"error": "Nie znaleziono sesji"}), 404
    if not _can_edit_session(owner, s):
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}

    if "title" in body:
        s.title = str(body["title"]).strip()[:200] or s.title
    if "description" in body:
        s.description = str(body["description"]).strip()[:5000] or None
    if "date_start" in body:
        s.date_start = str(body["date_start"])[:10] or None
    if "date_end" in body:
        s.date_end = str(body["date_end"])[:10] or None
    if body.get("status") in VALID_SESSION_STATUSES:
        s.status = body["status"]
    if body.get("risk") in VALID_SESSION_RISKS:
        s.risk = body["risk"]
    if body.get("scope") in VALID_SESSION_SCOPES:
        s.scope = body["scope"]

    campaign_id = body.get("campaign_id")
    new_campaign_name = str(body.get("new_campaign_name", "")).strip()[:200]
    if new_campaign_name and not campaign_id:
        camp = Campaign(name=new_campaign_name, created_by=owner.id)
        db.session.add(camp)
        db.session.flush()
        s.campaign_id = camp.id
    elif "campaign_id" in body:
        s.campaign_id = campaign_id or None

    if "character_ids" in body or "npc_names" in body:
        _sync_participants(
            s,
            body.get("character_ids", [p.character_id for p in s.participants if p.character_id]),
            body.get("npc_names",     [p.npc_name     for p in s.participants if p.npc_name]),
        )

    db.session.commit()
    return jsonify(s.to_dict())


@sessions_bp.route("/sessions/<int:sid>", methods=["DELETE"])
@require_auth
def delete_session(sid):
    owner = get_current_owner()
    s = db.session.get(Session, sid)
    if not s:
        return jsonify({"error": "Nie znaleziono sesji"}), 404
    if not _can_edit_session(owner, s):
        return jsonify({"error": "Brak uprawnień"}), 403
    db.session.delete(s)
    db.session.commit()
    return jsonify({"ok": True})


@sessions_bp.route("/sessions/<int:sid>/participants", methods=["PUT"])
@require_auth
def update_participants(sid):
    owner = get_current_owner()
    s = db.session.get(Session, sid)
    if not s:
        return jsonify({"error": "Nie znaleziono sesji"}), 404
    if not _can_edit_session(owner, s):
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    _sync_participants(s, body.get("character_ids", []), body.get("npc_names", []))
    db.session.commit()
    return jsonify(s.to_dict())


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sync_participants(session_obj, character_ids, npc_names):
    """Replace all participants with the given lists."""
    # Remove existing
    for p in list(session_obj.participants):
        db.session.delete(p)
    db.session.flush()

    # Add characters
    seen_chars = set()
    for cid in character_ids:
        try:
            cid = int(cid)
        except (TypeError, ValueError):
            continue
        if cid in seen_chars:
            continue
        if db.session.get(Character, cid):
            db.session.add(SessionParticipant(
                session_id=session_obj.id,
                character_id=cid,
            ))
            seen_chars.add(cid)

    # Add NPCs
    seen_npcs = set()
    for name in (npc_names or []):
        name = str(name).strip()[:200]
        if name and name not in seen_npcs:
            db.session.add(SessionParticipant(
                session_id=session_obj.id,
                npc_name=name,
            ))
            seen_npcs.add(name)
