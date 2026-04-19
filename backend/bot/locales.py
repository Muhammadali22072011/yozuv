TEXTS = {
    "UZ": {
        "welcome": "Xush kelibsiz! {business_name} ga yozilish uchun quyidagilardan birini tanlang:",
        "choose_service": "Xizmatni tanlang:",
        "choose_date": "Sanani tanlang:",
        "choose_time": "Vaqtni tanlang:",
        "confirm_booking": "Yozilishni tasdiqlaysizmi?\n\n📋 {service}\n📅 {date} soat {time}\n💰 {price} so'm",
        "booking_confirmed": "✅ Yozildingiz!\n\n📋 {service}\n📅 {date} soat {time}\n📍 {business}\n\n🔔 1 soat oldin eslatma yuboramiz",
        "booking_cancelled_by_owner": "❌ Yozilishingiz bekor qilindi\n\nSabab: {reason}\n\nQayta yozilishni xohlaysizmi?",
        "reminder": "⏰ Eslatma!\n\nBir soatdan so'ng sizda yozilish bor:\n📋 {service}\n📍 {business}",
        "new_booking_owner": "🆕 Yangi yozilish!\n\n👤 {client}\n📋 {service}\n📅 {date} soat {time}",
    },
    "RU": {
        "welcome": "Добро пожаловать! Выберите действие для записи в {business_name}:",
        "choose_service": "Выберите услугу:",
        "choose_date": "Выберите дату:",
        "choose_time": "Выберите время:",
        "confirm_booking": "Подтвердить запись?\n\n📋 {service}\n📅 {date} в {time}\n💰 {price} сум",
        "booking_confirmed": "✅ Вы записаны!\n\n📋 {service}\n📅 {date} в {time}\n📍 {business}\n\n🔔 Напомним за 1 час",
        "booking_cancelled_by_owner": "❌ Ваша запись отменена\n\nПричина: {reason}\n\nХотите записаться снова?",
        "reminder": "⏰ Напоминание!\n\nЧерез час у вас запись:\n📋 {service}\n📍 {business}",
        "new_booking_owner": "🆕 Новая запись!\n\n👤 {client}\n📋 {service}\n📅 {date} в {time}",
    },
}


def t(lang: str, key: str) -> str:
    lang = "RU" if lang.upper().startswith("R") else "UZ"
    return TEXTS[lang].get(key, key)
