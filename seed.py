import os
from models import db, Owner, Item
from utils import hash_password

SEED_ITEMS = {
    "DREWNO": [
        "Drewno dębowe", "Drewno jesionowe", "Drewno bukowe",
        "Drewno klonowe", "Drewno sosnowe",
    ],
    "GRZYBY": [
        "Śluzica jadalna", "Wronka smaczna", "Mięsnik górski",
        "Drabant brunatny", "Wiązówka księżycowa", "Miodziak jadowity",
        "Leśny książę", "Świeciec opętak", "Muchomor olbrzymi",
        "Muchomor jadalny", "Wróży kielich", "Gryfie jajo",
    ],
    "JEDZENIE": [
        "Pożywny banan", "Zielone jabłko", "Kawałek sera",
        "Bochenek chleba", "Dziki agrest", "Suszone mięso",
    ],
    "KAMIENIE SZLACHETNE": ["Opal", "Oszlifowany opal", "Ametyst"],
    "KOPALINY": [
        "Kunsztowna forma do mozaiki", "Złożona forma do mozaiki",
        "Prosta forma do mozaiki", "Sztabka brązu", "Sztabka stali",
        "Sztabka lazurostali", "Sztabka elfiej stali", "Sztabka cyny",
        "Sztabka cynku", "Sztabka miedzi", "Sztabka mosiądzu", "Sztabka żelaza",
        "Bryłka adamantytu", "Bryłka brązu", "Bryłka złota", "Bryłka srebra",
        "Bryłka żelaza", "Bryłka węgla", "Bryłka miedzi", "Bryłka cynku",
        "Bryłka cyny", "Bryłka mithrilu", "Grudka gliny", "Zwykły kamień",
    ],
    "KRYSZTAŁ": [
        "Oszlifowane smocze oko", "Oszlifowany złotnik", "Smocze oko",
        "Gorzknik", "Oszlifowany gorznik", "Łzawnik", "Oszlifowany łzawnik",
        "Kryształ ogniskujący", "Oszlifowany kryształ ogniskujący",
        "Kryształ górski", "Oszlifowany kryształ górski", "Cytryn",
        "Mgielnik", "Ciernik", "Szlachetnik", "Krwawnik", "Kawałek szkła",
    ],
    "MATERIAŁY ODZWIERZĘCE": [
        "Zwykłe pióro", "Zwykła skóra", "Szlachetna skóra",
        "Zwykła wyprawiona skóra", "Szlachetna wyprawiona skóra",
        "Zwykły ząb", "Ząb drapieżnika", "Pospolite pazury",
        "Unikatowe pazury", "Złocista muszla", "Mała muszelka",
        "Fragment futra", "Szlachetne wyprawione futro", "Ości tiruby",
        "Kości zwierzęce", "Zmurszała kość", "Skrzypce kraba",
        "Spetryfikowane szczypce kraba", "Surowe udko", "Kokon jedwabnika",
        "Pospolity róg", "Wełna", "Rzemień", "Szara perła", "Biała perła",
    ],
    "NARZĘDZIA": [
        "Papier", "Butelka szklana", "Butelka gliniana",
        "Pasta diamentowa", "Nicielnica atłasowa", "Narzędzia formierskie",
    ],
    "PÓŁPRODUKTY ALCHEMICZNE": [
        "Olejokoktajl", "Dusza wiedźmy", "Wódka ordynaryjna",
        "Mukhomork", "Okowita", "Płynny ogień", "Czarny proch",
    ],
    "ROŚLINY": [
        "Kolcolist", "Czosnek polny", "Pędy lnu", "Pędy konopne",
        "Bawełna", "Ziele podróżnika", "Siężygron", "Bagienne ziele",
        "Szalej", "Mandragora", "Pischa", "Kocia miętka", "Lawendzik", "Aloesowiec",
    ],
    "TKANINY": [
        "Nici bawełniane", "Tkanina bawełniana", "Wełniany filc",
        "Nici konopne", "Tkanina konopna", "Szantung", "Tkanina lniana", "Atłas",
    ],
    "ŚMIECI": [
        "Pusty bukłak", "Pusta sakiewska", "Prymitywny naszyjnik",
        "Przeminęło z anomalią", "Płócienny worek", "Futrzany chwost",
        "Pęknięta nordska tarcza", "Amulet szczęścia", "Stary róg",
        "Moneta kultystów", "Stary rytualny sztylet", "Kościany talizman",
        "Prosty młotek", "Stary kilof", "Dziwny krzemień",
    ],
    "INNE": ["Żelazo"],
}


def seed_items():
    """Seed item catalog if empty."""
    if db.session.query(Item).count() > 0:
        return
    for category, names in SEED_ITEMS.items():
        for name in names:
            db.session.add(Item(name=name, category=category, aliases=[], meta={}))
    db.session.commit()


def seed_admin():
    """Create default admin account if none exists."""
    if db.session.query(Owner).filter_by(role="admin").first():
        return
    admin = Owner(
        username="admin",
        email=os.environ.get("ADMIN_EMAIL", "admin@example.com"),
        password_hash=hash_password("admin123"),
        role="admin",
    )
    db.session.add(admin)
    db.session.commit()


def seed_data():
    seed_items()
    seed_admin()
