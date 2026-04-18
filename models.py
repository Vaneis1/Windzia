from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Owner(db.Model):
    __tablename__ = "owners"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default="owner", nullable=False)
    display_name = db.Column(db.String(100), nullable=True)
    display_role = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)

    characters = db.relationship(
        "Character", backref="owner", cascade="all, delete-orphan", lazy="select"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name or self.username,
            "email": self.email,
            "role": self.role,
            "display_role": self.display_role or self.role,
            "character_count": len(self.characters),
        }


# ── M2M: character ↔ house ─────────────────────────────────────────────────
character_houses = db.Table(
    "character_houses",
    db.Column(
        "character_id",
        db.Integer,
        db.ForeignKey("characters.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "house_id",
        db.Integer,
        db.ForeignKey("houses.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Character(db.Model):
    __tablename__ = "characters"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("owners.id"), nullable=False)
    profile_blocks = db.Column(db.JSON, default=list)
    profile_css = db.Column(db.Text, nullable=True)
    profile_public = db.Column(db.Boolean, default=False)
    avatar_url = db.Column(db.String(500), nullable=True)
    meta = db.Column(db.JSON, default=dict)
    tabs = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    inventory_entries = db.relationship(
        "Inventory", backref="character", cascade="all, delete-orphan", lazy="select"
    )
    houses = db.relationship(
        "House",
        secondary="character_houses",
        back_populates="characters",
        lazy="select",
    )

    def to_dict(self, include_owner=True):
        d = {
            "id": self.id,
            "name": self.name,
            "owner_id": self.owner_id,
            "profile_public": self.profile_public,
            "avatar_url": self.avatar_url,
            "houses": [h.to_dict() for h in (self.houses or [])],
        }
        if include_owner:
            d["owner_username"] = self.owner.username if self.owner else ""
        return d


class House(db.Model):
    __tablename__ = "houses"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    color = db.Column(db.String(7), default="#c9a45c", nullable=False)
    description = db.Column(db.Text, nullable=True)
    heraldry = db.Column(db.String(500), nullable=True)  # emoji lub URL
    created_by = db.Column(db.Integer, db.ForeignKey("owners.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    characters = db.relationship(
        "Character",
        secondary="character_houses",
        back_populates="houses",
        lazy="select",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "description": self.description or "",
            "heraldry": self.heraldry or "",
            "created_by": self.created_by,
        }


class Item(db.Model):
    __tablename__ = "items"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    aliases = db.Column(db.JSON, default=list)
    tags = db.Column(db.JSON, default=list)
    display_order = db.Column(db.Integer, default=0, nullable=False)
    unit = db.Column(db.String(20), nullable=True)
    meta = db.Column(db.JSON, default=dict)

    inventory_entries = db.relationship(
        "Inventory", backref="item", cascade="all, delete-orphan", lazy="select"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "aliases": self.aliases or [],
            "tags": self.tags or [],
            "display_order": self.display_order or 0,
            "unit": self.unit,
            "meta": self.meta or {},
        }


class Inventory(db.Model):
    __tablename__ = "inventory"

    id = db.Column(db.Integer, primary_key=True)
    character_id = db.Column(
        db.Integer, db.ForeignKey("characters.id"), nullable=False
    )
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    quantity = db.Column(db.Integer, default=0, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        db.UniqueConstraint("character_id", "item_id", name="uq_char_item"),
    )


class AppSettings(db.Model):
    __tablename__ = "app_settings"
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.JSON, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    @classmethod
    def get(cls, key, default=None):
        row = db.session.get(cls, key)
        return row.value if row else default

    @classmethod
    def set(cls, key, value):
        row = db.session.get(cls, key)
        if row:
            row.value = value
        else:
            db.session.add(cls(key=key, value=value))
        db.session.commit()
