import bcrypt
from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Owner, Item


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()


def check_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode(), hashed.encode())
    except Exception:
        return False


# ── Auth helpers ──────────────────────────────────────────────────────────────

def get_current_owner() -> Owner | None:
    try:
        owner_id = int(get_jwt_identity())
        return db.session.get(Owner, owner_id)
    except (ValueError, TypeError):
        return None


def require_auth(f):
    """Decorator: requires valid JWT token."""
    @wraps(f)
    @jwt_required()
    def wrapper(*args, **kwargs):
        owner = get_current_owner()
        if not owner:
            return jsonify({"error": "Nie znaleziono użytkownika"}), 401
        return f(*args, **kwargs)
    return wrapper


def require_role(*roles):
    """Decorator: requires valid JWT + specific role."""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def wrapper(*args, **kwargs):
            owner = get_current_owner()
            if not owner:
                return jsonify({"error": "Nie znaleziono użytkownika"}), 401
            if owner.role not in roles:
                return jsonify({"error": "Brak uprawnień"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# ── Item matching ─────────────────────────────────────────────────────────────

def match_item(raw_name: str, all_items: list[Item] | None = None) -> Item | None:
    """
    Match a raw OCR name to an Item in DB.
    Pass all_items to avoid repeated DB calls when matching many names.
    """
    n = raw_name.strip().rstrip(".…").strip().lower()
    if not n or len(n) < 2:
        return None

    if all_items is None:
        all_items = Item.query.all()

    # 1. Exact match (case-insensitive)
    for item in all_items:
        if item.name.lower() == n:
            return item

    # 2. Alias exact match
    for item in all_items:
        if any(a.lower() == n for a in (item.aliases or [])):
            return item

    # 3. Prefix match — handles truncated names like "Bryłka zło..."
    for item in all_items:
        item_lower = item.name.lower()
        if item_lower.startswith(n) or n.startswith(item_lower):
            return item
        for alias in (item.aliases or []):
            alias_lower = alias.lower()
            if alias_lower.startswith(n) or n.startswith(alias_lower):
                return item

    # 4. Character-by-character similarity (handles minor OCR errors)
    if len(n) >= 5:
        best_match = None
        best_score = 0.84  # minimum threshold

        for item in all_items:
            targets = [item.name.lower()] + [a.lower() for a in (item.aliases or [])]
            for target in targets:
                length = min(len(n), len(target))
                if length < 4:
                    continue
                shared = sum(
                    1 for i, c in enumerate(n[:length])
                    if i < len(target) and target[i] == c
                )
                score = shared / length
                if score > best_score:
                    best_score = score
                    best_match = item

        if best_match:
            return best_match

    return None
