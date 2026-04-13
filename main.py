import os
import json
import httpx
from functools import wraps
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
CORS(app, origins=["https://vaneis1.github.io", "http://localhost"])

db_url = os.environ.get("DATABASE_URL", "sqlite:///inventory.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
PROMPT = (
    "This is a game inventory screenshot in Polish. "
    "Extract every visible item and its quantity (the small number badge on the top-left of each slot). "
    "Return ONLY a raw JSON array, no markdown, no explanation: "
    '[{"name":"Polish item name","quantity":number},...]. '
    "If no badge is visible, use 1. Include all sections."
)

class Character(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    entries = db.relationship("Inventory", backref="character", cascade="all, delete-orphan")

class Inventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    character_id = db.Column(db.Integer, db.ForeignKey("character.id"), nullable=False)
    item_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("character_id", "item_name"),)

with app.app_context():
    db.create_all()

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        pwd = request.headers.get("X-Admin-Password", "")
        if pwd != ADMIN_PASSWORD:
            return jsonify({"error": "Nieprawidlowe haslo"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route("/health")
def health():
    return jsonify({"ok": True})

@app.route("/admin/verify", methods=["POST"])
def verify_admin():
    pwd = request.get_json().get("password", "")
    if pwd == ADMIN_PASSWORD:
        return jsonify({"ok": True})
    return jsonify({"error": "Nieprawidlowe haslo"}), 401

@app.route("/characters", methods=["GET"])
def get_characters():
    chars = Character.query.order_by(Character.created_at).all()
    return jsonify([{"id": c.id, "name": c.name} for c in chars])

@app.route("/characters", methods=["POST"])
def add_character():
    name = request.get_json().get("name", "").strip()
    if not name:
        return jsonify({"error": "Brak nazwy"}), 400
    if Character.query.filter_by(name=name).first():
        return jsonify({"error": "Postac juz istnieje"}), 409
    c = Character(name=name)
    db.session.add(c)
    db.session.commit()
    return jsonify({"id": c.id, "name": c.name}), 201

@app.route("/characters/<int:cid>", methods=["DELETE"])
def delete_character(cid):
    c = Character.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/inventory", methods=["GET"])
def get_inventory():
    chars = Character.query.order_by(Character.created_at).all()
    all_entries = Inventory.query.all()
    items = {}
    for e in all_entries:
        if e.item_name not in items:
            items[e.item_name] = {}
        items[e.item_name][e.character_id] = e.quantity
    return jsonify({
        "characters": [{"id": c.id, "name": c.name} for c in chars],
        "items": [{"name": name, "quantities": qtys} for name, qtys in sorted(items.items())]
    })

@app.route("/scan", methods=["POST"])
def scan():
    if not API_KEY:
        return jsonify({"error": "Brak klucza API na serwerze"}), 500
    body = request.get_json()
    images = body.get("images", [])
    character_name = body.get("character", "")
    save = body.get("save", False)
    if not images:
        return jsonify({"error": "Brak obrazow"}), 400
    all_items = {}
    for img in images:
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": img.get("mime_type", "image/png"), "data": img["data"]}},
            {"type": "text", "text": PROMPT}
        ]
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01"},
            json={"model": "claude-haiku-4-5-20251001", "max_tokens": 1000, "messages": [{"role": "user", "content": content}]},
            timeout=30,
        )
        data = response.json()
        if "error" in data:
            return jsonify({"error": data["error"]["message"]}), 500
        raw = "".join(b.get("text", "") for b in data.get("content", [])).replace("```json", "").replace("```", "").strip()
        for item in json.loads(raw):
            name = item["name"]
            all_items[name] = all_items.get(name, 0) + item.get("quantity", 1)
    result = [{"name": k, "quantity": v} for k, v in all_items.items()]
    if save and character_name:
        char = Character.query.filter_by(name=character_name).first()
        if not char:
            char = Character(name=character_name)
            db.session.add(char)
            db.session.flush()
        for item in result:
            entry = Inventory.query.filter_by(character_id=char.id, item_name=item["name"]).first()
            if entry:
                entry.quantity = item["quantity"]
                entry.updated_at = datetime.utcnow()
            else:
                db.session.add(Inventory(character_id=char.id, item_name=item["name"], quantity=item["quantity"]))
        db.session.commit()
    return jsonify(result)

@app.route("/export", methods=["GET"])
def export_csv():
    data = get_inventory().get_json()
    chars = data["characters"]
    items = data["items"]
    lines = ["Przedmiot," + ",".join(c["name"] for c in chars)]
    for item in items:
        row = [item["name"]] + [str(item["quantities"].get(c["id"], "")) for c in chars]
        lines.append(",".join(row))
    return Response("\n".join(lines), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment;filename=inwentarz.csv"})

@app.route("/admin/inventory/<int:cid>", methods=["PUT"])
@require_admin
def admin_update_entry(cid):
    body = request.get_json()
    item_name = body.get("item_name")
    quantity = int(body.get("quantity", 0))
    entry = Inventory.query.filter_by(character_id=cid, item_name=item_name).first()
    if entry:
        entry.quantity = quantity
        entry.updated_at = datetime.utcnow()
    else:
        db.session.add(Inventory(character_id=cid, item_name=item_name, quantity=quantity))
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/inventory/<int:cid>/<path:item_name>", methods=["DELETE"])
@require_admin
def admin_delete_entry(cid, item_name):
    entry = Inventory.query.filter_by(character_id=cid, item_name=item_name).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/inventory/<int:cid>", methods=["DELETE"])
@require_admin
def admin_clear_character(cid):
    Inventory.query.filter_by(character_id=cid).delete()
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/characters/<int:cid>", methods=["PUT"])
@require_admin
def admin_rename_character(cid):
    c = Character.query.get_or_404(cid)
    new_name = request.get_json().get("name", "").strip()
    if not new_name:
        return jsonify({"error": "Brak nazwy"}), 400
    if Character.query.filter(Character.name == new_name, Character.id != cid).first():
        return jsonify({"error": "Nazwa juz istnieje"}), 409
    c.name = new_name
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/admin/characters/<int:cid>", methods=["DELETE"])
@require_admin
def admin_delete_character(cid):
    c = Character.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
