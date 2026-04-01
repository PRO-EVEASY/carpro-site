import phonenumbers
from phonenumbers import geocoder, carrier, number_type
import requests
from bs4 import BeautifulSoup
from rich import print
from rich.panel import Panel

def analyze_number(num):
    try:
        pn = phonenumbers.parse(num, None)
    except:
        print("[red]❌ מספר לא תקין[/red]")
        return None

    valid = phonenumbers.is_valid_number(pn)
    region = geocoder.description_for_number(pn, "he")
    carr = carrier.name_for_number(pn, "he")
    ntype = number_type(pn)

    return {
        "valid": valid,
        "region": region,
        "carrier": carr,
        "type": str(ntype)
    }

def google_search(num):
    url = f"https://www.google.com/search?q=\"{num}\""
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        r = requests.get(url, headers=headers, timeout=5)
        soup = BeautifulSoup(r.text, "html.parser")
        results = soup.find_all("h3")
        return [r.text for r in results[:5]]
    except:
        return []

def spam_score(results):
    score = 0
    keywords = ["spam", "scam", "fraud", "הטרדה", "עוקץ"]
    for r in results:
        for k in keywords:
            if k.lower() in r.lower():
                score += 1
    return min(score, 5)

def main():
    num = input("📱 הכנס מספר (עם קידומת +972): ")

    data = analyze_number(num)
    if not data:
        return

    print(Panel.fit(f"""
✔ תקין: {data['valid']}
🌍 אזור: {data['region']}
📡 מפעיל: {data['carrier']}
📱 סוג: {data['type']}
""", title="📡 ניתוח מספר"))

    results = google_search(num)

    print("\n🦆 תוצאות חיפוש:")
    for r in results:
        print(f"➡️ {r}")

    score = spam_score(results)

    print(f"\n🚨 ציון ספאם: {score}/5")

    clean = num.replace("+", "")
    print("\n🔗 קישורים:")
    print(f"WhatsApp: https://wa.me/{clean}")
    print(f"Google: https://www.google.com/search?q=\"{clean}\"")
    print(f"Truecaller: https://www.truecaller.com/search/il/{clean}")

if __name__ == "__main__":
    main()
