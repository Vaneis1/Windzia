"""Profile routes — visual profile + metadata + tabs + gallery."""
from flask import Blueprint, request, jsonify
from sqlalchemy import or_

from models import db, Character, Owner, AppSettings
from utils import get_current_owner, require_auth, require_role
from css_sanitizer import process_user_css
from json_validator import validate_profile_blocks

profiles_bp = Blueprint("profiles", __name__)

# Limits
MAX_TABS = 10
MAX_TAB_NAME_LENGTH = 50
MAX_BIO_LENGTH = 5000
MAX_QUOTES = 50
MAX_HOOKS = 30
MAX_EVENTS = 200


# ── Visual profile (legacy: first tab) ────────────────────────────────────────

@profiles_bp.route("/characters/<int:cid>/profile", methods=["GET"])
def get_profile(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    return jsonify({
        "id": char.id,
        "name": char.name,
        "owner_username": char.owner.username if char.owner else "",
        "owner_display": (char.owner.display_name or char.owner.username) if char.owner else "",
        "profile_blocks": char.profile_blocks or [],
        "profile_css": char.profile_css or "",
        "profile_public": char.profile_public,
        "avatar_url": char.avatar_url,
        "meta": char.meta or {},
        "tabs": char.tabs or [],
    })


@profiles_bp.route("/characters/<int:cid>/profile", methods=["PUT"])
@require_auth
def save_profile(cid):
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    warnings = []

    if "profile_blocks" in body:
        ok, err = validate_profile_blocks(body["profile_blocks"])
        if not ok:
            return jsonify({"error": f"Błąd walidacji JSON: {err}"}), 400
        char.profile_blocks = body["profile_blocks"]

    if "profile_css" in body:
        raw_css = body.get("profile_css") or ""
        if not isinstance(raw_css, str):
            return jsonify({"error": "profile_css musi być tekstem"}), 400
        char.profile_css = raw_css
        _, css_warnings = process_user_css(raw_css)
        warnings.extend(css_warnings)

    if "profile_public" in body:
        char.profile_public = bool(body["profile_public"])

    if "avatar_url" in body:
        char.avatar_url = body.get("avatar_url") or None

    db.session.commit()
    response = {"ok": True}
    if warnings:
        response["warnings"] = warnings
    return jsonify(response)


@profiles_bp.route("/characters/<int:cid>/profile/css", methods=["GET"])
def get_profile_css(cid):
    char = db.session.get(Character, cid)
    if not char or not char.profile_css:
        return "", 200, {"Content-Type": "text/css"}
    sanitized, _ = process_user_css(char.profile_css)
    return sanitized, 200, {"Content-Type": "text/css; charset=utf-8"}


# ── Character metadata (Info tab — predefined) ────────────────────────────────

def _validate_meta(meta: dict) -> tuple[bool, str | None]:
    """Validate metadata structure."""
    if not isinstance(meta, dict):
        return False, "meta musi być obiektem"

    # String fields
    for key in ("avatar_url", "age", "house", "location", "bio"):
        if key in meta and meta[key] is not None and not isinstance(meta[key], str):
            return False, f"Pole {key} musi być tekstem"
    if len(meta.get("bio") or "") > MAX_BIO_LENGTH:
        return False, f"Bio za długie (max {MAX_BIO_LENGTH} znaków)"

    # Quotes: [{id, text, source}]
    quotes = meta.get("quotes", [])
    if not isinstance(quotes, list):
        return False, "quotes musi być tablicą"
    if len(quotes) > MAX_QUOTES:
        return False, f"Za dużo cytatów (max {MAX_QUOTES})"
    for q in quotes:
        if not isinstance(q, dict) or not isinstance(q.get("text", ""), str):
            return False, "Każdy cytat musi mieć pole text"
        if len(q.get("text", "")) > 1000:
            return False, "Cytat za długi (max 1000 znaków)"

    # Story hooks: [{id, title, description}]
    hooks = meta.get("story_hooks", [])
    if not isinstance(hooks, list):
        return False, "story_hooks musi być tablicą"
    if len(hooks) > MAX_HOOKS:
        return False, f"Za dużo wątków (max {MAX_HOOKS})"

    # Events: [{id, date, title, description}]
    events = meta.get("events", [])
    if not isinstance(events, list):
        return False, "events musi być tablicą"
    if len(events) > MAX_EVENTS:
        return False, f"Za dużo wydarzeń (max {MAX_EVENTS})"
    for e in events:
        if not isinstance(e, dict):
            return False, "Każde wydarzenie musi być obiektem"
        date = e.get("date", "")
        if date and not isinstance(date, str):
            return False, "Data wydarzenia musi być tekstem (YYYY-MM-DD)"

    return True, None


@profiles_bp.route("/characters/<int:cid>/meta", methods=["GET"])
def get_meta(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    return jsonify(char.meta or {})


@profiles_bp.route("/characters/<int:cid>/meta", methods=["PUT"])
@require_auth
def save_meta(cid):
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    ok, err = _validate_meta(body)
    if not ok:
        return jsonify({"error": err}), 400

    char.meta = body
    # If avatar_url was set in meta, sync to top-level field too
    if "avatar_url" in body:
        char.avatar_url = body.get("avatar_url") or None
    db.session.commit()
    return jsonify({"ok": True})


# ── Custom tabs (with their own blocks + css) ─────────────────────────────────

def _validate_tabs(tabs: list) -> tuple[bool, str | None, int]:
    """Validate tabs structure. Returns (ok, error, total_size_bytes)."""
    if not isinstance(tabs, list):
        return False, "tabs musi być tablicą", 0
    if len(tabs) > MAX_TABS:
        return False, f"Za dużo zakładek (max {MAX_TABS})", 0

    import json as _json
    total_size = 0
    for i, tab in enumerate(tabs):
        if not isinstance(tab, dict):
            return False, f"Zakładka #{i+1} musi być obiektem", total_size
        name = tab.get("name", "").strip()
        if not name:
            return False, f"Zakładka #{i+1} nie ma nazwy", total_size
        if len(name) > MAX_TAB_NAME_LENGTH:
            return False, f"Nazwa zakładki #{i+1} za długa", total_size

        blocks_payload = tab.get("blocks_data", {"blocks": [], "settings": {}})
        ok, err = validate_profile_blocks(blocks_payload)
        if not ok:
            return False, f"Zakładka „{name}\": {err}", total_size

        # Per-tab size warning
        tab_json = _json.dumps(tab)
        size = len(tab_json.encode('utf-8'))
        total_size += size
        if size > 50_000:
            # Soft warning — still allow but flag it later
            pass

    return True, None, total_size


@profiles_bp.route("/characters/<int:cid>/tabs", methods=["GET"])
def get_tabs(cid):
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    return jsonify(char.tabs or [])


@profiles_bp.route("/characters/<int:cid>/tabs", methods=["PUT"])
@require_auth
def save_tabs(cid):
    owner = get_current_owner()
    char = db.session.get(Character, cid)
    if not char:
        return jsonify({"error": "Nie znaleziono postaci"}), 404
    if owner.role != "admin" and char.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403

    body = request.get_json(silent=True) or {}
    tabs = body.get("tabs", [])
    ok, err, size = _validate_tabs(tabs)
    if not ok:
        return jsonify({"error": err}), 400

    char.tabs = tabs

    # Sanitize CSS in each tab if present
    warnings = []
    for tab in tabs:
        if tab.get("css"):
            _, w = process_user_css(tab["css"])
            warnings.extend(f"Zakładka „{tab.get('name')}\": {x}" for x in w)

    db.session.commit()
    response = {"ok": True, "size_bytes": size}
    if size > 100_000:
        warnings.insert(0, f"Profil zajmuje {size//1024}KB — zalecane <100KB")
    if warnings:
        response["warnings"] = warnings
    return jsonify(response)


# ── Gallery (all characters) ──────────────────────────────────────────────────

@profiles_bp.route("/gallery", methods=["GET"])
@require_auth
def gallery():
    """Return all characters with key info for the gallery view."""
    chars = (
        Character.query
        .join(Owner, Character.owner_id == Owner.id)
        .order_by(Character.name)
        .all()
    )
    out = []
    for c in chars:
        meta = c.meta or {}
        # Find featured quote: first marked, or just first quote
        featured_quote = None
        quotes = meta.get("quotes", []) or []
        featured_id = meta.get("featured_quote_id")
        if featured_id:
            featured_quote = next((q for q in quotes if q.get("id") == featured_id), None)
        if not featured_quote and quotes:
            featured_quote = quotes[0]

        out.append({
            "id": c.id,
            "name": c.name,
            "avatar_url": c.avatar_url or meta.get("avatar_url"),
            "owner_display": (c.owner.display_name or c.owner.username) if c.owner else "",
            "owner_username": c.owner.username if c.owner else "",
            "age": meta.get("age", ""),
            "house": meta.get("house", ""),
            "location": meta.get("location", ""),
            "featured_quote": featured_quote,
            "profile_public": c.profile_public,
        })
    return jsonify(out)


# ── Calendar settings (admin only for write) ──────────────────────────────────

DEFAULT_CALENDAR = {
    "enabled": False,
    "month_names": ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
                    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
    "year_offset": 0,
    "era_suffix": "",
}


@profiles_bp.route("/settings/calendar", methods=["GET"])
def get_calendar():
    cal = AppSettings.get("calendar", DEFAULT_CALENDAR)
    return jsonify(cal)


@profiles_bp.route("/settings/calendar", methods=["PUT"])
@require_role("admin")
def save_calendar():
    body = request.get_json(silent=True) or {}

    # Validate structure
    months = body.get("month_names", DEFAULT_CALENDAR["month_names"])
    if not isinstance(months, list) or len(months) != 12:
        return jsonify({"error": "month_names musi mieć dokładnie 12 nazw"}), 400
    if not all(isinstance(m, str) and len(m) <= 50 for m in months):
        return jsonify({"error": "Każda nazwa miesiąca to tekst max 50 znaków"}), 400

    try:
        offset = int(body.get("year_offset", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "year_offset musi być liczbą"}), 400

    cal = {
        "enabled": bool(body.get("enabled", False)),
        "month_names": months,
        "year_offset": offset,
        "era_suffix": str(body.get("era_suffix", ""))[:50],
    }
    AppSettings.set("calendar", cal)
    return jsonify({"ok": True, "calendar": cal})
