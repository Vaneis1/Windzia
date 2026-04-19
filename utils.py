import unicodedata
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

def _normalize(s: str) -> str:
    """
    Normalize string for fuzzy comparison:
    - lowercase
    - strip Polish diacritics (ą→a, ę→e, ó→o, ś→s, ż/ź→z, ń→n, ł→l, ć→c)
    - strip trailing ellipsis / dots
    - collapse whitespace
    """
    s = s.strip().rstrip(".…").strip().lower()
    # Remove diacritics via Unicode decomposition
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    # Collapse multiple spaces
    s = " ".join(s.split())
    return s


def _levenshtein(a: str, b: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if a == b:
        return 0
    if len(a) == 0:
        return len(b)
    if len(b) == 0:
        return len(a)

    # Use two-row DP for memory efficiency
    prev = list(range(len(b) + 1))
    curr = [0] * (len(b) + 1)

    for i, ca in enumerate(a, 1):
        curr[0] = i
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr[j] = min(
                prev[j] + 1,       # deletion
                curr[j - 1] + 1,   # insertion
                prev[j - 1] + cost # substitution
            )
        prev, curr = curr, prev

    return prev[len(b)]


def _similarity(a: str, b: str) -> float:
    """
    Return similarity ratio 0–1 based on Levenshtein distance.
    1.0 = identical, 0.0 = completely different.
    """
    if not a or not b:
        return 0.0
    dist = _levenshtein(a, b)
    max_len = max(len(a), len(b))
    return 1.0 - dist / max_len


def _all_targets(item: Item) -> list[str]:
    """Return normalized name + normalized aliases for an item."""
    targets = [_normalize(item.name)]
    for alias in (item.aliases or []):
        if alias:
            targets.append(_normalize(alias))
    return targets


def match_item(raw_name: str, all_items: list[Item] | None = None) -> Item | None:
    """
    Match a raw OCR name to an Item in DB using multi-stage fuzzy matching.

    Stages (first match wins):
    1. Exact match on normalized name/aliases
    2. Prefix match — handles truncated OCR names like "Bryłka zło..."
       (raw is prefix of item name, or item name is prefix of raw)
    3. Levenshtein similarity ≥ 0.72 on full name
    4. Levenshtein similarity ≥ 0.65 on prefix of item name (same length as raw)
       — handles "Druuno bukowo" → "Drewno bukowe"
    """
    n = _normalize(raw_name)
    if not n or len(n) < 2:
        return None

    if all_items is None:
        all_items = Item.query.all()

    # ── Stage 1: Exact match ──────────────────────────────────────────────────
    for item in all_items:
        if any(t == n for t in _all_targets(item)):
            return item

    # ── Stage 2: Prefix match ─────────────────────────────────────────────────
    # Raw name is a prefix of item name (truncated OCR)
    # or item name is a prefix of raw (OCR added noise at end)
    for item in all_items:
        for t in _all_targets(item):
            if len(t) >= 5 and len(n) >= 5:
                if t.startswith(n) or n.startswith(t):
                    return item

    # ── Stage 3: Full Levenshtein similarity ≥ 0.72 ──────────────────────────
    if len(n) >= 4:
        best_item = None
        best_score = 0.72

        for item in all_items:
            for t in _all_targets(item):
                score = _similarity(n, t)
                if score > best_score:
                    best_score = score
                    best_item = item

        if best_item:
            return best_item

    # ── Stage 4: Prefix Levenshtein — truncated names with OCR errors ─────────
    # Compare raw against the first len(raw) chars of each item name
    # Handles: "Druuno buko" → "Drewno buko..." → "Drewno bukowe"
    if len(n) >= 6:
        best_item = None
        best_score = 0.65

        for item in all_items:
            for t in _all_targets(item):
                if len(t) < len(n) - 3:
                    # Item name too short to be a credible truncated match
                    continue
                # Compare against prefix of same length
                prefix = t[:len(n)]
                score = _similarity(n, prefix)
                if score > best_score:
                    best_score = score
                    best_item = item

        if best_item:
            return best_item

    return None
