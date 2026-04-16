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
 
 
class Character(db.Model):
    __tablename__ = "characters"
 
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("owners.id"), nullable=False)
    profile_blocks = db.Column(db.JSON, default=list)
    profile_public = db.Column(db.Boolean, default=False)
    avatar_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
 
    inventory_entries = db.relationship(
        "Inventory", backref="character", cascade="all, delete-orphan", lazy="select"
    )
 
    def to_dict(self, include_owner=True):
        d = {"id": self.id, "name": self.name, "owner_id": self.owner_id,
             "profile_public": self.profile_public, "avatar_url": self.avatar_url}
        if include_owner:
            d["owner_username"] = self.owner.username if self.owner else ""
        return d
 
 
class Item(db.Model):
    __tablename__ = "items"
 
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    aliases = db.Column(db.JSON, default=list)
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
            "meta": self.meta or {},
        }
 
 
class Inventory(db.Model):
    __tablename__ = "inventory"
 
    id = db.Column(db.Integer, primary_key=True)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id"), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    quantity = db.Column(db.Integer, default=0, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
 
    __table_args__ = (
        db.UniqueConstraint("character_id", "item_id", name="uq_char_item"),
    )
