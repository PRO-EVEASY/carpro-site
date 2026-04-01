import requests
from bs4 import BeautifulSoup
import urllib.parse
import sys
import re
import phonenumbers
from phonenumbers import carrier, geocoder

headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10)"
}

def analyze_number(number):
    print("\n📡 ניתוח מספר:\n")

    try:
        parsed = phonenumbers.parse(number, "IL")

        valid = phonenumbers.is_valid_number(parsed)
        carrier_name = carrier.name_for_number(parsed, "en")
        location = geocoder.description_for_number(parsed, "en")

        print(f"✔ תקין: {valid}")
        print(f"📶 מפעיל: {carrier_name if carrier_name else 'לא ידוע'}")
        print(f"🌍 אזור: {location if location else 'לא ידוע'}")

        # זיהוי VOIP
        if carrier_name == "":
            print("⚠️ חשד: VOIP / מספר וירטואלי")

    except:
        print("❌ לא הצליח לנתח מספר")

def pattern_analysis(number):
    print("\n🧠 ניתוח תבנית:\n")

    if number.startswith("052"):
        print("📱 כנראה סלקום")
    elif number.startswith("050"):
        print("📱 כנראה פלאפון")
    elif number.startswith("054"):
        print("📱 כנראה פרטנר")
    elif number.startswith("053"):
        print("📱 כנראה HOT / וירטואלי")
    elif number.startswith("055"):
        print("📱 VOIP / מספר אינטרנטי")
    else:
        print("❓ לא מזוהה")

def duckduckgo(number):
    print("\n🦆 חיפוש:\n")

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

        print("➡️", clean)
        links.append(clean)

    return links

def spam_detection(links):
    print("\n🚨 בדיקת ספאם:\n")

    spam_score = 0

    for link in links:
        try:
            r = requests.get(link, headers=headers, timeout=5)
            text = r.text.lower()

            if any(word in text for word in ["spam", "scam", "telemarketing"]):
                spam_score += 1

        except:
            continue

    print(f"📊 ציון ספאם: {spam_score}/5")

    if spam_score >= 2:
        print("🚨 סיכוי גבוה לספאם")
    else:
        print("✅ לא נראה ספאם ברור")

def whatsapp(number):
    print("\n📱 WhatsApp:\n")
    num = number.replace("0", "972", 1)
    print(f"https://wa.me/{num}")

def main():
    if len(sys.argv) < 2:
        print("שימוש: python finder_lvl4.py 052XXXXXXXX")
        return

    number = sys.argv[1]

    analyze_number(number)
    pattern_analysis(number)

    links = duckduckgo(number)

    spam_detection(links)

    whatsapp(number)

if __name__ == "__main__":
    main()
