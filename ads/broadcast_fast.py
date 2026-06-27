#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yozuv broadcast FAST — фото грузится 1 раз (file_id) + многопоточно.
Возобновляемый: общие логи с обычным скриптом (_sent / _blocked / _failed).

ЗАПУСК (PowerShell):
    cd D:\yozuv\ads
    $env:BOT_TOKEN="8278890980:AAH..."
    python broadcast_fast.py
"""
import os, sys, time, json, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests

# ---------- НАСТРОЙКИ ----------
TOKEN        = os.environ.get("BOT_TOKEN", "").strip()
CHAT_IDS     = r"D:\Загрузки\Telegram Desktop\real_users_chatids.txt"
PHOTO        = r"D:\yozuv\ads\yozuv_ad_1080.png"
CAPTION_FILE = r"D:\yozuv\ads\caption.txt"
BUTTON_TEXT  = "🚀 Bepul boshlash"
BUTTON_URL   = "https://t.me/Yozuv_cl_bot"
RATE         = 25          # сообщений/сек (лимит Telegram ~30; держим 25)
WORKERS      = 12          # потоков (перекрывают сетевую задержку)
PROBE_CHAT   = 2050639074  # куда отправить фото 1 раз, чтобы взять file_id (потом удалится)
# --------------------------------

SENT_FILE   = r"D:\yozuv\ads\_sent.txt"
BLOCKED_FILE= r"D:\yozuv\ads\_blocked.txt"
FAILED_FILE = r"D:\yozuv\ads\_failed.txt"
API = f"https://api.telegram.org/bot{TOKEN}"

def load(p):
    f=Path(p); return set(x.strip() for x in f.read_text(encoding="utf-8").splitlines() if x.strip()) if f.exists() else set()

# --- throttle: ровный темп RATE/сек на всех потоках ---
_tlock=threading.Lock(); _next=[time.time()]; GAP=1.0/RATE
def throttle():
    with _tlock:
        now=time.time(); wait=_next[0]-now
        if wait>0: time.sleep(wait)
        _next[0]=max(now,_next[0])+GAP

_wlock=threading.Lock()
counters={"ok":0,"blk":0,"err":0}
fs={}

def get_file_id(caption, markup):
    with open(PHOTO,"rb") as p:
        r=requests.post(f"{API}/sendPhoto",
            data={"chat_id":PROBE_CHAT,"caption":caption,"parse_mode":"HTML","reply_markup":markup,"disable_notification":True},
            files={"photo":("ad.png",p,"image/png")}, timeout=60)
    j=r.json()
    if not j.get("ok"): sys.exit(f"Не удалось взять file_id: {j}")
    msg=j["result"]; fid=msg["photo"][-1]["file_id"]
    requests.post(f"{API}/deleteMessage", data={"chat_id":PROBE_CHAT,"message_id":msg["message_id"]}, timeout=30)
    return fid

def send(chat_id, file_id, caption, markup):
    data={"chat_id":chat_id,"photo":file_id,"caption":caption,"parse_mode":"HTML","reply_markup":markup}
    throttle()
    try:
        r=requests.post(f"{API}/sendPhoto", data=data, timeout=60)
    except requests.RequestException:
        rec("err",chat_id,FAILED_FILE); return
    c=r.status_code
    if c==200: rec("ok",chat_id,SENT_FILE)
    elif c==429:
        try: ra=r.json().get("parameters",{}).get("retry_after",3)
        except: ra=3
        time.sleep(ra+1); throttle()
        try:
            r2=requests.post(f"{API}/sendPhoto", data=data, timeout=60)
            rec("ok",chat_id,SENT_FILE) if r2.status_code==200 else rec("err",chat_id,FAILED_FILE)
        except requests.RequestException: rec("err",chat_id,FAILED_FILE)
    elif c==403: rec("blk",chat_id,BLOCKED_FILE)
    else: rec("err",chat_id,FAILED_FILE)

def rec(kind, chat_id, fpath):
    with _wlock:
        counters[{"ok":"ok","blk":"blk","err":"err"}[kind]]+=1
        fs[fpath].write(chat_id+"\n"); fs[fpath].flush()

def main():
    if not TOKEN: sys.exit("BOT_TOKEN не задан.")
    caption=Path(CAPTION_FILE).read_text(encoding="utf-8").strip()
    markup=json.dumps({"inline_keyboard":[[{"text":BUTTON_TEXT,"url":BUTTON_URL}]]})
    file_id=get_file_id(caption, markup)
    print("file_id получен — картинка больше не грузится, шлём по id.")

    allids=[x.strip() for x in Path(CHAT_IDS).read_text(encoding="utf-8").splitlines() if x.strip()]
    done=load(SENT_FILE)|load(BLOCKED_FILE)
    ids=[i for i in allids if i not in done]
    print(f"Всего {len(allids)} | уже {len(done)} | сейчас шлём {len(ids)} | темп ~{RATE}/сек, {WORKERS} потоков")
    if not ids: print("Всё уже разослано."); return

    for f in (SENT_FILE,BLOCKED_FILE,FAILED_FILE): fs[f]=open(f,"a",encoding="utf-8")
    t0=time.time()
    def task(cid): send(cid,file_id,caption,markup)
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for n,_ in enumerate(ex.map(task, ids),1):
            if n%500==0:
                el=time.time()-t0; spd=n/max(el,1); eta=int((len(ids)-n)/max(spd,0.1))
                print(f"{n}/{len(ids)} | ✅{counters['ok']} 🚫{counters['blk']} ⚠️{counters['err']} | {spd:.0f}/сек | ~{eta//60}м {eta%60}с")
    for f in fs.values(): f.close()
    print("\n===== ИТОГ =====")
    print(f"✅ Доставлено (живые): {counters['ok']}")
    print(f"🚫 Заблок/не старт:    {counters['blk']}")
    print(f"⚠️ Ошибок:             {counters['err']}")
    print(f"⏱  {int(time.time()-t0)} сек")

if __name__=="__main__":
    main()
