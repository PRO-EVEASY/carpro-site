import requests
from bs4 import BeautifulSoup
import urllib.parse
import sys
import re

headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10)"
}

def clean_ddg_link(link):
    if "uddg=" in link:
        clean = urllib.parse.parse_qs(
            urllib.parse.urlparse(link).query
        ).get("uddg", [""])[0]
        return urllib.parse.unquote(clean)
    return link

def duckduckgo(number):
    print("\n🦆 DuckDuckGo:\n")

    query = urllib.parse.quote(number)
    url = f"https://html.duckduckgo.com/html/?q={query}"

    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, "html.parser")

    results = soup.find_all("a", class_="result__a")

    links = []
    for res in results[:5]:
        link = clean_ddg_link(res.get("href"))
        print("➡️", link)
        links.append(link)

    return links

def bing(number):
    print("\n🔎 Bing:\n")

    query = urllib.parse.quote(number)
    url = f"https://www.bing.com/search?q={query}"

    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, "html.parser")

    results = soup.select("li.b_algo h2 a")

    links = []
    for res in results[:5]:
        link = res.get("href")
        print("➡️", link)
        links.append(link)

    return links

def analyze(links):
    print("\n🧠 ניתוח:\n")

    spam_score = 0
    name_hits = 0

    for link in links:
        try:
            r = requests.get(link, headers=headers, timeout=5)
            text = r.text.lower()

            # ספאם
            if any(word in text for word in ["spam", "telemarketing", "scam"]):
                spam_score += 1

            # שם
            matches = re.findall(r"(שם|name|owner)[^\\n]{0,40}", text)
            if matches:
                name_hits += 1
                print(f"💡 רמז לשם ב-{link}:")
                print(matches[0])

        except:
            continue

    return spam_score, name_hits

def whatsapp(number):
    print("\n📱 WhatsApp:\n")
    num = number.replace("0", "972", 1)
    print(f"https://wa.me/{num}")

def final_assessment(spam_score, name_hits):
    print("\n📊 סיכום:\n")

    if spam_score >= 2:
        print("🚨 כנראה ספאם / טלמרקטינג")
    elif name_hits > 0:
        print("👤 יש סיכוי שזה אדם/עסק מזוהה")
    else:
        print("❓ לא נמצא מידע ברור")

def main():
    if len(sys.argv) < 2:
        print("שימוש: python finder_pro.py 052XXXXXXXX")
        return

    number = sys.argv[1]

    links = duckduckgo(number) + bing(number)

    spam_score, name_hits = analyze(links)

    whatsapp(number)

    final_assessment(spam_score, name_hits)

if __name__ == "__main__":
    main()
