import os
import json
import httpx
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)

app = Flask(__name__)
CORS(app)
# ── Config ────────────────────────────────────────────
db_url = os.environ.get("DATABASE_URL", "sqlite:///inventory.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET", secrets.token_hex(32))
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)

db = SQLAlchemy(app)
jwt = JWTManager(app)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "mpkrupa1@gmail.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://vaneis1.github.io/Windzia")

SCAN_PROMPT = (
    "This is a game inventory screenshot in Polish. "
    "Extract every visible item and its quantity (the small number badge on the top-left of each slot). "
    "Return ONLY a raw JSON array, no markdown, no explanation: "
    '[{"name":"Polish item name","quantity":number},...]. '
    "If no badge is visible, use 1. Include all sections."
)

# ── Models ────────────────────────────────────────────
class Owner(db.Model):
    __tablename__ = "owners"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default="owner")  # "admin" | "owner"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    characters = db.relationship("Character", backref="owner", cascade="all, delete-orphan")

class Character(db.Model):
    __tablename__ = "characters"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("owners.id"), nullable=False)
    profile_blocks = db.Column(db.JSON, default=list)
    profile_public = db.Column(db.Boolean, default=False)
    avatar_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    inventory = db.relationship("Inventory", backref="character", cascade="all, delete-orphan")

class Item(db.Model):
    __tablename__ = "items"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    aliases = db.Column(db.JSON, default=list)
    meta = db.Column(db.JSON, default=dict)
    inventory = db.relationship("Inventory", backref="item", cascade="all, delete-orphan")

class Inventory(db.Model):
    __tablename__ = "inventory"
    id = db.Column(db.Integer, primary_key=True)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id"), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    quantity = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("character_id", "item_id"),)

# ── Auth helpers ──────────────────────────────────────
def hash_password(pwd): return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
def check_password(pwd, hashed): return bcrypt.checkpw(pwd.encode(), hashed.encode())

def require_role(*roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            owner = Owner.query.get(identity)
            if not owner or owner.role not in roles:
                return jsonify({"error": "Brak uprawnień"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

def require_auth(f):
    @wraps(f)
    @jwt_required()
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)
    return wrapper

def current_owner():
    return Owner.query.get(get_jwt_identity())

# ── Item matching ─────────────────────────────────────
def match_item(raw_name):
    """Match a raw OCR name to an Item in DB. Returns Item or None."""
    n = raw_name.strip().rstrip(".…").strip().lower()
    # Exact match
    item = Item.query.filter(db.func.lower(Item.name) == n).first()
    if item: return item
    # Alias match
    all_items = Item.query.all()
    for item in all_items:
        aliases = item.aliases or []
        if any(a.lower() == n for a in aliases):
            return item
    # Prefix match (handles truncated names like "Bryłka zło...")
    for item in all_items:
        if item.name.lower().startswith(n) or n.startswith(item.name.lower()):
            return item
        for alias in (item.aliases or []):
            if alias.lower().startswith(n) or n.startswith(alias.lower()):
                return item
    # Similarity match (85% chars in order)
    if len(n) >= 5:
        for item in all_items:
            targets = [item.name.lower()] + [a.lower() for a in (item.aliases or [])]
            for target in targets:
                length = min(len(n), len(target))
                shared = sum(1 for i, c in enumerate(n[:length]) if i < len(target) and target[i] == c)
                if length > 0 and shared / length >= 0.85:
                    return item
    return None

# ── Seed data ─────────────────────────────────────────
SEED_ITEMS = {
    "DREWNO": ["Drewno dębowe","Drewno jesionowe","Drewno bukowe","Drewno klonowe","Drewno sosnowe"],
    "GRZYBY": ["Śluzica jadalna","Wronka smaczna","Mięsnik górski","Drabant brunatny","Wiązówka księżycowa","Miodziak jadowity","Leśny książę","Świeciec opętak","Muchomor olbrzymi","Muchomor jadalny","Wróży kielich","Gryfie jajo"],
    "JEDZENIE": ["Pożywny banan","Zielone jabłko","Kawałek sera","Bochenek chleba","Dziki agrest","Suszone mięso"],
    "KAMIENIE SZLACHETNE": ["Opal","Oszlifowany opal","Ametyst"],
    "KOPALINY": ["Kunsztowna forma do mozaiki","Złożona forma do mozaiki","Prosta forma do mozaiki","Sztabka brązu","Sztabka stali","Sztabka lazurostali","Sztabka elfiej stali","Sztabka cyny","Sztabka cynku","Sztabka miedzi","Sztabka mosiądzu","Sztabka żelaza","Bryłka adamantytu","Bryłka brązu","Bryłka złota","Bryłka srebra","Bryłka żelaza","Bryłka węgla","Bryłka miedzi","Bryłka cynku","Bryłka cyny","Bryłka mithrilu","Grudka gliny","Zwykły kamień"],
    "KRYSZTAŁ": ["Oszlifowane smocze oko","Oszlifowany złotnik","Smocze oko","Gorzknik","Oszlifowany gorznik","Łzawnik","Oszlifowany łzawnik","Kryształ ogniskujący","Oszlifowany kryształ ogniskujący","Kryształ górski","Oszlifowany kryształ górski","Cytryn","Mgielnik","Ciernik","Szlachetnik","Krwawnik","Kawałek szkła"],
    "MATERIAŁY ODZWIERZĘCE": ["Zwykłe pióro","Zwykła skóra","Szlachetna skóra","Zwykła wyprawiona skóra","Szlachetna wyprawiona skóra","Zwykły ząb","Ząb drapieżnika","Pospolite pazury","Unikatowe pazury","Złocista muszla","Mała muszelka","Fragment futra","Szlachetne wyprawione futro","Ości tiruby","Kości zwierzęce","Zmurszała kość","Skrzypce kraba","Spetryfikowane szczypce kraba","Surowe udko","Kokon jedwabnika","Pospolity róg","Wełna","Rzemień","Szara perła","Biała perła"],
    "NARZĘDZIA": ["Papier","Butelka szklana","Butelka gliniana","Pasta diamentowa","Nicielnica atłasowa","Narzędzia formierskie"],
    "PÓŁPRODUKTY ALCHEMICZNE": ["Olejokoktajl","Dusza wiedźmy","Wódka ordynaryjna","Mukhomork","Okowita","Płynny ogień","Czarny proch"],
    "ROŚLINY": ["Kolcolist","Czosnek polny","Pędy lnu","Pędy konopne","Bawełna","Ziele podróżnika","Siężygron","Bagienne ziele","Szalej","Mandragora","Pischa","Kocia miętka","Lawendzik","Aloesowiec"],
    "TKANINY": ["Nici bawełniane","Tkanina bawełniana","Wełniany filc","Nici konopne","Tkanina konopna","Szantung","Tkanina lniana","Atłas"],
    "ŚMIECI": ["Pusty bukłak","Pusta sakiewska","Prymitywny naszyjnik","Przeminęło z anomalią","Płócienny worek","Futrzany chwost","Pęknięta nordska tarcza","Amulet szczęścia","Stary róg","Moneta kultystów","Stary rytualny sztylet","Kościany talizman","Prosty młotek","Stary kilof","Dziwny krzemień"],
    "INNE": ["Żelazo"],
}

def seed_items():
    if Item.query.count() > 0: return
    for category, names in SEED_ITEMS.items():
        for name in names:
            db.session.add(Item(name=name, category=category, aliases=[], meta={}))
    db.session.commit()

def seed_admin():
    if Owner.query.filter_by(role="admin").first(): return
    admin = Owner(
        username="admin",
        email=ADMIN_EMAIL,
        password_hash=hash_password("admin123"),
        role="admin"
    )
    db.session.add(admin)
    db.session.commit()

with app.app_context():
    db.create_all()
    seed_items()
    seed_admin()

# ── Auth endpoints ────────────────────────────────────
@app.route("/auth/login", methods=["POST"])
def login():
    body = request.get_json()
    owner = Owner.query.filter_by(email=body.get("email","").lower().strip()).first()
    if not owner or not check_password(body.get("password",""), owner.password_hash):
        return jsonify({"error": "Nieprawidłowy email lub hasło"}), 401
    token = create_access_token(identity=owner.id)
    return jsonify({"token": token, "role": owner.role, "username": owner.username, "id": owner.id})

@app.route("/auth/me", methods=["GET"])
@require_auth
def me():
    owner = current_owner()
    if not owner: return jsonify({"error": "Nie znaleziono użytkownika"}), 404
    return jsonify({"id": owner.id, "username": owner.username, "email": owner.email, "role": owner.role})

@app.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    email = request.get_json().get("email","").lower().strip()
    owner = Owner.query.filter_by(email=email).first()
    if not owner:
        return jsonify({"ok": True})  # Don't reveal if email exists
    token = secrets.token_urlsafe(32)
    owner.reset_token = token
    owner.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    reset_url = f"{FRONTEND_URL}?reset={token}"
    if RESEND_API_KEY:
        httpx.post("https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": "Wandzi Windzi <noreply@resend.dev>", "to": [email],
                  "subject": "Reset hasła — Wandzi Windzi",
                  "html": f"<p>Kliknij link aby zresetować hasło (ważny 1h):</p><a href='{reset_url}'>{reset_url}</a>"})
    return jsonify({"ok": True})

@app.route("/auth/reset-password", methods=["POST"])
def reset_password():
    body = request.get_json()
    token = body.get("token","")
    new_password = body.get("password","")
    if len(new_password) < 6:
        return jsonify({"error": "Hasło musi mieć minimum 6 znaków"}), 400
    owner = Owner.query.filter_by(reset_token=token).first()
    if not owner or not owner.reset_token_expires or owner.reset_token_expires < datetime.utcnow():
        return jsonify({"error": "Token wygasł lub jest nieprawidłowy"}), 400
    owner.password_hash = hash_password(new_password)
    owner.reset_token = None
    owner.reset_token_expires = None
    db.session.commit()
    return jsonify({"ok": True})

# ── Owner management (admin only) ─────────────────────
@app.route("/admin/owners", methods=["GET"])
@require_role("admin")
def list_owners():
    owners = Owner.query.order_by(Owner.created_at).all()
    return jsonify([{"id": o.id, "username": o.username, "email": o.email, "role": o.role,
                     "character_count": len(o.characters)} for o in owners])

@app.route("/admin/owners", methods=["POST"])
@require_role("admin")
def create_owner():
    body = request.get_json()
    username = body.get("username","").strip()
    email = body.get("email","").lower().strip()
    password = body.get("password","")
    role = body.get("role","owner")
    if not username or not email or not password:
        return jsonify({"error": "Wypełnij wszystkie pola"}), 400
    if Owner.query.filter_by(email=email).first():
        return jsonify({"error": "Email już zajęty"}), 409
    if Owner.query.filter_by(username=username).first():
        return jsonify({"error": "Nazwa użytkownika już zajęta"}), 409
    owner = Owner(username=username, email=email, password_hash=hash_password(password), role=role)
    db.session.add(owner)
    db.session.commit()
    return jsonify({"id": owner.id, "username": owner.username}), 201

@app.route("/admin/owners/<int:oid>", methods=["DELETE"])
@require_role("admin")
def delete_owner(oid):
    owner = Owner.query.get_or_404(oid)
    db.session.delete(owner)
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/owners/<int:oid>/reset-password", methods=["PUT"])
@require_role("admin")
def admin_reset_password(oid):
    owner = Owner.query.get_or_404(oid)
    new_pwd = request.get_json().get("password","")
    if len(new_pwd) < 6:
        return jsonify({"error": "Hasło musi mieć min. 6 znaków"}), 400
    owner.password_hash = hash_password(new_pwd)
    db.session.commit()
    return jsonify({"ok": True})

# ── Characters ─────────────────────────────────────────
@app.route("/characters", methods=["GET"])
@require_auth
def get_characters():
    owner = current_owner()
    if owner.role == "admin":
        chars = Character.query.order_by(Character.created_at).all()
    else:
        chars = Character.query.filter_by(owner_id=owner.id).order_by(Character.created_at).all()
    return jsonify([{"id": c.id, "name": c.name, "owner_id": c.owner_id,
                     "owner_username": c.owner.username, "profile_public": c.profile_public,
                     "avatar_url": c.avatar_url} for c in chars])

@app.route("/characters", methods=["POST"])
@require_auth
def add_character():
    owner = current_owner()
    body = request.get_json()
    name = body.get("name","").strip()
    owner_id = body.get("owner_id", owner.id) if owner.role == "admin" else owner.id
    if not name:
        return jsonify({"error": "Brak nazwy"}), 400
    c = Character(name=name, owner_id=owner_id)
    db.session.add(c)
    db.session.commit()
    return jsonify({"id": c.id, "name": c.name}), 201

@app.route("/characters/<int:cid>", methods=["DELETE"])
@require_auth
def delete_character(cid):
    owner = current_owner()
    c = Character.query.get_or_404(cid)
    if owner.role != "admin" and c.owner_id != owner.id:
        return jsonify({"error": "Brak uprawnień"}), 403
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})

# ── Items (catalog) ────────────────────────────────────
@app.route("/items", methods=["GET"])
@require_auth
def get_items():
    category = request.args.get("category")
    q = Item.query
    if category:
        q = q.filter_by(category=category)
    items = q.order_by(Item.category, Item.name).all()
    return jsonify([{"id": i.id, "name": i.name, "category": i.category,
                     "aliases": i.aliases, "meta": i.meta} for i in items])

@app.route("/items/categories", methods=["GET"])
@require_auth
def get_categories():
    cats = db.session.query(Item.category).distinct().order_by(Item.category).all()
    return jsonify([c[0] for c in cats])

@app.route("/items", methods=["POST"])
@require_role("admin")
def add_item():
    body = request.get_json()
    name = body.get("name","").strip()
    category = body.get("category","").strip()
    if not name or not category:
        return jsonify({"error": "Brak nazwy lub kategorii"}), 400
    if Item.query.filter_by(name=name).first():
        return jsonify({"error": "Przedmiot już istnieje"}), 409
    item = Item(name=name, category=category, aliases=body.get("aliases",[]), meta=body.get("meta",{}))
    db.session.add(item)
    db.session.commit()
    return jsonify({"id": item.id, "name": item.name}), 201

@app.route("/items/<int:iid>", methods=["PUT"])
@require_role("admin")
def update_item(iid):
    item = Item.query.get_or_404(iid)
    body = request.get_json()
    if "name" in body: item.name = body["name"].strip()
    if "category" in body: item.category = body["category"].strip()
    if "aliases" in body: item.aliases = body["aliases"]
    if "meta" in body: item.meta = body["meta"]
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/items/<int:iid>", methods=["DELETE"])
@require_role("admin")
def delete_item(iid):
    item = Item.query.get_or_404(iid)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})

# ── Inventory ──────────────────────────────────────────
@app.route("/inventory", methods=["GET"])
@require_auth
def get_inventory():
    owner = current_owner()
    category = request.args.get("category")
    if owner.role == "admin":
        chars = Character.query.order_by(Character.created_at).all()
    else:
        chars = Character.query.filter_by(owner_id=owner.id).order_by(Character.created_at).all()

    item_q = Item.query
    if category:
        item_q = item_q.filter_by(category=category)
    all_items = item_q.order_by(Item.category, Item.name).all()

    char_ids = [c.id for c in chars]
    entries = Inventory.query.filter(Inventory.character_id.in_(char_ids)).all() if char_ids else []
    qty_map = {(e.character_id, e.item_id): e.quantity for e in entries}

    return jsonify({
        "characters": [{"id": c.id, "name": c.name, "owner_username": c.owner.username} for c in chars],
        "categories": sorted(set(i.category for i in all_items)),
        "items": [{"id": i.id, "name": i.name, "category": i.category,
                   "quantities": {str(c.id): qty_map.get((c.id, i.id), 0) for c in chars}}
                  for i in all_items]
    })

# ── Scan ───────────────────────────────────────────────
@app.route("/scan", methods=["POST"])
@require_auth
def scan():
    if not ANTHROPIC_API_KEY:
        return jsonify({"error": "Brak klucza API na serwerze"}), 500
    owner = current_owner()
    body = request.get_json()
    images = body.get("images", [])
    character_id = body.get("character_id")
    save = body.get("save", False)

    if not images:
        return jsonify({"error": "Brak obrazów"}), 400

    if character_id:
        char = Character.query.get(character_id)
        if not char:
            return jsonify({"error": "Nie znaleziono postaci"}), 404
        if owner.role != "admin" and char.owner_id != owner.id:
            return jsonify({"error": "Brak uprawnień do tej postaci"}), 403

    # Scan all images, collect raw names
    raw_items = {}
    for img in images:
        content = [
            {"type": "image", "source": {"type": "base64",
             "media_type": img.get("mime_type","image/png"), "data": img["data"]}},
            {"type": "text", "text": SCAN_PROMPT}
        ]
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY,
                     "anthropic-version": "2023-06-01"},
            json={"model": "claude-haiku-4-5-20251001", "max_tokens": 1000,
                  "messages": [{"role": "user", "content": content}]},
            timeout=30,
        )
        data = response.json()
        if "error" in data:
            return jsonify({"error": data["error"]["message"]}), 500
        raw = "".join(b.get("text","") for b in data.get("content",[])).replace("```json","").replace("```","").strip()
        for item in json.loads(raw):
            name = item["name"]
            raw_items[name] = raw_items.get(name, 0) + item.get("quantity", 1)

    # Match to DB items
    matched = []
    unmatched = []
    for raw_name, qty in raw_items.items():
        item = match_item(raw_name)
        if item:
            # Deduplicate: if same item matched twice, sum quantities
            existing = next((m for m in matched if m["item_id"] == item.id), None)
            if existing:
                existing["quantity"] += qty
            else:
                matched.append({"item_id": item.id, "name": item.name,
                                 "category": item.category, "raw_name": raw_name, "quantity": qty})
        else:
            unmatched.append({"raw_name": raw_name, "quantity": qty})

    # Save to DB
    if save and character_id:
        for m in matched:
            entry = Inventory.query.filter_by(character_id=character_id, item_id=m["item_id"]).first()
            if entry:
                entry.quantity = m["quantity"]
                entry.updated_at = datetime.utcnow()
            else:
                db.session.add(Inventory(character_id=character_id, item_id=m["item_id"], quantity=m["quantity"]))
        db.session.commit()

    return jsonify({"matched": matched, "unmatched": unmatched})

# ── Admin inventory edits ──────────────────────────────
@app.route("/admin/inventory/<int:cid>/<int:item_id>", methods=["PUT"])
@require_role("admin")
def admin_update_entry(cid, item_id):
    qty = int(request.get_json().get("quantity", 0))
    entry = Inventory.query.filter_by(character_id=cid, item_id=item_id).first()
    if entry:
        entry.quantity = qty
        entry.updated_at = datetime.utcnow()
    else:
        db.session.add(Inventory(character_id=cid, item_id=item_id, quantity=qty))
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/inventory/<int:cid>/<int:item_id>", methods=["DELETE"])
@require_role("admin")
def admin_delete_entry(cid, item_id):
    entry = Inventory.query.filter_by(character_id=cid, item_id=item_id).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/inventory/<int:cid>", methods=["DELETE"])
@require_role("admin")
def admin_clear_character(cid):
    Inventory.query.filter_by(character_id=cid).delete()
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/characters/<int:cid>", methods=["PUT"])
@require_role("admin")
def admin_update_character(cid):
    c = Character.query.get_or_404(cid)
    body = request.get_json()
    if "name" in body: c.name = body["name"].strip()
    if "owner_id" in body: c.owner_id = body["owner_id"]
    db.session.commit()
    return jsonify({"ok": True})

# ── Export ─────────────────────────────────────────────
@app.route("/export", methods=["GET"])
@require_auth
def export_csv():
    owner = current_owner()
    category = request.args.get("category")
    if owner.role == "admin":
        chars = Character.query.order_by(Character.created_at).all()
    else:
        chars = Character.query.filter_by(owner_id=owner.id).order_by(Character.created_at).all()

    item_q = Item.query
    if category: item_q = item_q.filter_by(category=category)
    all_items = item_q.order_by(Item.category, Item.name).all()

    char_ids = [c.id for c in chars]
    entries = Inventory.query.filter(Inventory.character_id.in_(char_ids)).all() if char_ids else []
    qty_map = {(e.character_id, e.item_id): e.quantity for e in entries}

    lines = ["Kategoria,Przedmiot," + ",".join(c.name for c in chars)]
    for item in all_items:
        row = [item.category, item.name] + [str(qty_map.get((c.id, item.id), "")) for c in chars]
        lines.append(",".join(f'"{v}"' for v in row))

    return Response("\n".join(lines), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment;filename=inwentarz.csv"})

# ── Health ─────────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"ok": True})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
