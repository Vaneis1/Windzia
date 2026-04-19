import os
import secrets
from datetime import timedelta

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager

from models import db
from seed import seed_data
from routes.auth import auth_bp
from routes.characters import characters_bp
from routes.items import items_bp
from routes.inventory import inventory_bp
from routes.admin import admin_bp
from routes.profiles import profiles_bp
from routes.houses import houses_bp
from routes.events import events_bp


def _run_migrations(app):
    """Add missing columns to existing tables (safe to run multiple times)."""
    migrations = [
        # events table — new columns added in Etap 4
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id VARCHAR(30)",
        "CREATE INDEX IF NOT EXISTS ix_events_external_id ON events (external_id)",
        # event_participants table — created fresh by db.create_all if missing
        # but if events existed, participants might not exist yet either
    ]
    with app.app_context():
        with db.engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(db.text(sql))
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    app.logger.warning(f"Migration skipped ({sql[:50]}...): {e}")


def create_app() -> Flask:
    app = Flask(__name__)

    # ── Database ──────────────────────────────────────────────────────────────
    db_url = os.environ.get("DATABASE_URL", "sqlite:///inventory.db")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config.update(
        SQLALCHEMY_DATABASE_URI=db_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "pool_recycle": 300},
        JWT_SECRET_KEY=os.environ.get("JWT_SECRET", secrets.token_hex(32)),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(days=7),
    )

    # ── Extensions ────────────────────────────────────────────────────────────
    CORS(app)
    db.init_app(app)
    JWTManager(app)

    # ── Blueprints ────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(characters_bp)
    app.register_blueprint(items_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(profiles_bp)
    app.register_blueprint(houses_bp)
    app.register_blueprint(events_bp)

    # ── Health check ──────────────────────────────────────────────────────────
    from flask import jsonify

    @app.route("/health")
    def health():
        return jsonify({"ok": True})

    # ── DB init + migrations + seed ───────────────────────────────────────────
    with app.app_context():
        db.create_all()
        _run_migrations(app)
        seed_data()

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
