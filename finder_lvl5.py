import requests
from bs4 import BeautifulSoup
import urllib.parse
import sys
import phonenumbers
from phonenumbers import carrier
import json
import os

headers = {
    "User-Agent": "Mozilla/5.0"
}

LOG_FILE = "numbers_log.json"

def load_log():
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            return json.load(f)
    return {}

def save_log(data):
    with open(LOG_FILE, "w") as f:
        json.dump(data, f, indent=2)

def update_log(number, log):
    if number not in log:
        log[number] = {"checks": 1}
    else:
        log[number]["checks"] += 1
    return log[number]["checks"]

def analyze_number(number):
    try:
        parsed = phonenumbers.parse(number, "IL")
        carrier_name = carrier.name_for_number(parsed, "en")
        return carrier_name
    except:
        return "unknown"

def duckduckgo(number):
    query = urllib.parse.quote(number)
    url = f"https://html.duckduckgo.com/html/?q={query}"

    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, "html.parser")

    results = soup.find_all("a", class_="result__a")

    links = []
    for res in results[:5]:
        raw = res.get("href")
        if "uddg=" in raw:
            clean = urllib.parse.parse_qs(
                urllib.parse.urlparse(raw).query
            ).get("uddg", [""])[0]
            clean = urllib.parse.unquote(clean)
        else:
            clean = raw
        links.append(clean)

    return links

def spam_score(links):
    score = 0
    for link in links:
        try:
            r = requests.get(link, headers=headers, timeout=5)
            text = r.text.lower()
            if any(w in text for w in ["spam", "scam", "telemarketing"]):
                score += 1
        except:
            continue
    return score

def decision(score, checks):
    print("\n📊 החלטה:\n")

    if score >= 2 and checks > 1:
        print("🚨 לחסום מיד (ספאם חוזר)")
    elif score >= 2:
        print("⚠️ כנראה ספאם – להיזהר")
    elif checks > 2:
        print("⚠️ מספר חוזר – שים לב")
    else:
        print("✅ לא נראה מסוכן")

def main():
    if len(sys.argv) < 2:
        print("שימוש: python finder_lvl5.py 052XXXXXXXX")
        return

    number = sys.argv[1]

    log = load_log()
    checks = update_log(number, log)
    save_log(log)

    print(f"\n🔢 בדיקות קודמות למספר: {checks}\n")

    carrier_name = analyze_number(number)
    print(f"📶 מפעיל: {carrier_name}")

    links = duckduckgo(number)
    score = spam_score(links)

    print(f"\n🚨 ציון ספאם: {score}/5")

    decision(score, checks)

    print("\n📱 WhatsApp:")
    print("https://wa.me/" + number.replace("0", "972", 1))

if __name__ == "__main__":
    main()
