#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yozuv broadcast — рассылка фото+кнопка по списку chat_id.

ЗАПУСК (PowerShell):
    $env:BOT_TOKEN="8278890980:AAH..."        # токен бота (того, где юзеры жали /start)
    python broadcast.py

ЗАПУСК (cmd):
    set BOT_TOKEN=8278890980:AAH...
    python broadcast.py

Возобновляемый: уже отправленные id пишутся в _sent.txt и пропускаются при повторном запуске.
Дойдёт только тем, кто реально жал /start у этого бота и не заблокировал его.
"""

import os, sys, time, json
from pathlib import Path
import requests

# ---------- НАСТРОЙКИ ----------
TOKEN        = os.environ.get("BOT_TOKEN", "").strip()
CHAT_IDS     = r"D:\Загрузки\Telegram Desktop\real_users_chatids.txt"
PHOTO        = r"D:\yozuv\ads\yozuv_ad_1080.png"
CAPTION_FILE = r"D:\yozuv\ads\caption.txt"
BUTTON_TEXT  = "🚀 Bepul boshlash"
BUTTON_URL   = "https://t.me/Yozuv_cl_bot"
RATE         = 20          # сообщений в секунду (лимит Telegram ~30, держим запас)
# --------------------------------

SENT_FILE   = r"D:\yozuv\ads\_sent.txt"
BLOCKED_FILE= r"D:\yozuv\ads\_blocked.txt"
FAILED_FILE = r"D:\yozuv\ads\_failed.txt"

def load_lines(p):
    f = Path(p)
    return set(x.strip() for x in f.read_text(encoding="utf-8").splitlines() if x.strip()) if f.exists() else set()

def main():
    if not TOKEN:
        sys.exit("ОШИБКА: BOT_TOKEN не задан. Сначала set/$env:BOT_TOKEN=...")

    caption = Path(CAPTION_FILE).read_text(encoding="utf-8").strip()
    photo_bytes = Path(PHOTO).read_bytes()          # читаем картинку 1 раз в память
    markup = json.dumps({"inline_keyboard": [[{"text": BUTTON_TEXT, "url": BUTTON_URL}]]})

    all_ids = [x.strip() for x in Path(CHAT_IDS).read_text(encoding="utf-8").splitlines() if x.strip()]
    already = load_lines(SENT_FILE) | load_lines(BLOCKED_FILE)   # пропустить уже обработанных
    ids = [i for i in all_ids if i not in already]

    total = len(ids)
    print(f"Всего в списке: {len(all_ids)} | уже обработано: {len(already)} | к отправке сейчас: {total}")
    if total == 0:
        print("Нечего слать — все уже обработаны."); return

    url = f"https://api.telegram.org/bot{TOKEN}/sendPhoto"
    delivered = blocked = failed = 0
    delay = 1.0 / RATE
    sent_f    = open(SENT_FILE,    "a", encoding="utf-8")
    blocked_f = open(BLOCKED_FILE, "a", encoding="utf-8")
    failed_f  = open(FAILED_FILE,  "a", encoding="utf-8")
    t0 = time.time()

    for n, chat_id in enumerate(ids, 1):
        data = {"chat_id": chat_id, "caption": caption,
                "parse_mode": "HTML", "reply_markup": markup}
        try:
            r = requests.post(url, data=data,
                              files={"photo": ("ad.png", photo_bytes, "image/png")},
                              timeout=60)
        except requests.RequestException:
            failed += 1; failed_f.write(chat_id + "\n"); failed_f.flush()
            time.sleep(delay); continue

        code = r.status_code
        if code == 200:
            delivered += 1; sent_f.write(chat_id + "\n"); sent_f.flush()
        elif code == 429:                                   # flood control
            retry = 5
            try: retry = r.json().get("parameters", {}).get("retry_after", 5)
            except Exception: pass
            print(f"  flood wait {retry}s …"); time.sleep(retry + 1)
            try:
                r2 = requests.post(url, data=data,
                                   files={"photo": ("ad.png", photo_bytes, "image/png")},
                                   timeout=60)
                if r2.status_code == 200:
                    delivered += 1; sent_f.write(chat_id + "\n"); sent_f.flush()
                else:
                    failed += 1; failed_f.write(chat_id + "\n"); failed_f.flush()
            except requests.RequestException:
                failed += 1; failed_f.write(chat_id + "\n"); failed_f.flush()
        elif code == 403:                                   # бот заблокирован / не стартовали
            blocked += 1; blocked_f.write(chat_id + "\n"); blocked_f.flush()
        else:
            failed += 1; failed_f.write(chat_id + "\n"); failed_f.flush()

        if n % 200 == 0:
            spd = n / max(time.time() - t0, 1)
            eta = int((total - n) / max(spd, 0.1))
            print(f"{n}/{total} | доставлено {delivered} | заблок {blocked} | ошибок {failed} | ~{eta//60} мин осталось")
        time.sleep(delay)

    sent_f.close(); blocked_f.close(); failed_f.close()
    print("\n========== ИТОГ ==========")
    print(f"Доставлено (живые юзеры):       {delivered}")
    print(f"Заблокировали / не стартовали:  {blocked}")
    print(f"Ошибки (см. _failed.txt):       {failed}")
    print(f"Время: {int(time.time()-t0)} сек")
    print("delivered = реальное число живых подписчиков бота.")

if __name__ == "__main__":
    main()
