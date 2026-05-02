"""Uzbekistan administrative divisions: viloyat -> tuman/shahar.

Used for hierarchical location filters in onboarding and client search.
Names are in Uzbek (Latin). Includes Toshkent shahri (city of Tashkent)
as a separate top-level entry alongside the 12 viloyats and Qoraqalpog'iston.
"""

UZ_VILOYAT_TUMAN: dict[str, list[str]] = {
    "Toshkent shahri": [
        "Bektemir", "Chilonzor", "Mirobod", "Mirzo Ulug'bek", "Sergeli",
        "Shayxontohur", "Olmazor", "Uchtepa", "Yakkasaroy", "Yashnobod",
        "Yunusobod", "Yangihayot",
    ],
    "Toshkent viloyati": [
        "Angren", "Bekobod", "Chirchiq", "Olmaliq", "Yangiyo'l", "Nurafshon",
        "Bo'stonliq", "Bo'ka", "Chinoz", "Qibray", "Ohangaron", "O'rtachirchiq",
        "Parkent", "Piskent", "Quyichirchiq", "Yangiyo'l tumani", "Yuqorichirchiq",
        "Zangiota", "Oqqo'rg'on",
    ],
    "Andijon": [
        "Andijon shahri", "Asaka", "Xonobod", "Andijon tumani", "Baliqchi",
        "Bo'z", "Buloqboshi", "Izboskan", "Jalaquduq", "Xo'jaobod",
        "Qo'rg'ontepa", "Marhamat", "Oltinko'l", "Paxtaobod", "Shahrixon",
        "Ulug'nor",
    ],
    "Buxoro": [
        "Buxoro shahri", "Kogon", "Buxoro tumani", "G'ijduvon", "Jondor",
        "Kogon tumani", "Olot", "Peshku", "Qorako'l", "Qorovulbozor",
        "Romitan", "Shofirkon", "Vobkent",
    ],
    "Farg'ona": [
        "Farg'ona shahri", "Marg'ilon", "Qo'qon", "Quvasoy", "Bog'dod",
        "Beshariq", "Buvayda", "Dang'ara", "Farg'ona tumani", "Furqat",
        "Qo'shtepa", "Quva", "Rishton", "So'x", "Toshloq", "Uchko'prik",
        "O'zbekiston", "Yozyovon",
    ],
    "Jizzax": [
        "Jizzax shahri", "Arnasoy", "Baxmal", "Do'stlik", "Forish", "G'allaorol",
        "Sharof Rashidov", "Mirzacho'l", "Paxtakor", "Yangiobod", "Zafarobod",
        "Zarbdor", "Zomin",
    ],
    "Xorazm": [
        "Urganch", "Xiva", "Bog'ot", "Gurlan", "Hazorasp", "Xonqa",
        "Qo'shko'pir", "Shovot", "Urganch tumani", "Yangiariq", "Yangibozor",
        "Tuproqqal'a",
    ],
    "Namangan": [
        "Namangan shahri", "Chortoq", "Chust", "Kosonsoy", "Mingbuloq",
        "Namangan tumani", "Norin", "Pop", "To'raqo'rg'on", "Uchqo'rg'on",
        "Uychi", "Yangiqo'rg'on",
    ],
    "Navoiy": [
        "Navoiy shahri", "Zarafshon", "Karmana", "Konimex", "Qiziltepa",
        "Navbahor", "Nurota", "Tomdi", "Uchquduq", "Xatirchi",
    ],
    "Qashqadaryo": [
        "Qarshi", "Shahrisabz", "Chiroqchi", "Dehqonobod", "G'uzor",
        "Kasbi", "Kitob", "Koson", "Qamashi", "Qarshi tumani", "Mirishkor",
        "Muborak", "Nishon", "Yakkabog'", "Shahrisabz tumani",
    ],
    "Qoraqalpog'iston": [
        "Nukus", "Amudaryo", "Beruniy", "Bo'zatov", "Chimboy", "Ellikqal'a",
        "Kegeyli", "Mo'ynoq", "Nukus tumani", "Qanliko'l", "Qo'ng'irot",
        "Qorao'zak", "Shumanay", "Taxiatosh", "Taxtako'pir", "To'rtko'l",
        "Xo'jayli",
    ],
    "Samarqand": [
        "Samarqand shahri", "Kattaqo'rg'on", "Bulung'ur", "Ishtixon",
        "Jomboy", "Kattaqo'rg'on tumani", "Narpay", "Nurobod", "Oqdaryo",
        "Paxtachi", "Payariq", "Pastdarg'om", "Qo'shrabot", "Samarqand tumani",
        "Tayloq", "Urgut",
    ],
    "Sirdaryo": [
        "Guliston", "Shirin", "Yangiyer", "Boyovut", "Guliston tumani",
        "Mirzaobod", "Oqoltin", "Sayxunobod", "Sardoba", "Sirdaryo tumani",
        "Xovos",
    ],
    "Surxondaryo": [
        "Termiz", "Angor", "Bandixon", "Boysun", "Denov", "Jarqo'rg'on",
        "Muzrabot", "Oltinsoy", "Qiziriq", "Qumqo'rg'on", "Sariosiyo",
        "Sherobod", "Sho'rchi", "Termiz tumani", "Uzun",
    ],
}


def list_viloyats() -> list[str]:
    return list(UZ_VILOYAT_TUMAN.keys())


def list_tumans(viloyat: str) -> list[str]:
    return list(UZ_VILOYAT_TUMAN.get(viloyat, []))


def is_valid(viloyat: str, tuman: str | None = None) -> bool:
    if not viloyat:
        return False
    if viloyat not in UZ_VILOYAT_TUMAN:
        return False
    if tuman is not None and tuman != "" and tuman not in UZ_VILOYAT_TUMAN[viloyat]:
        return False
    return True
