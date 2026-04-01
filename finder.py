import requests
from bs4 import BeautifulSoup
import sys
import urllib.parse

def search_google(number):
    print(f"\n🔍 מחפש בגוגל: {number}\n")

    query = urllib.parse.quote(number)
    url = f"https://www.google.com/search?q={query}"

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, "html.parser")

    results = soup.find_all('a')

    links = []
    for link in results:
        href = link.get('href')
        if href and "/url?q=" in href:
            clean = href.split("/url?q=")[1].split("&")[0]
            if "google" not in clean:
                links.append(clean)

    unique_links = list(dict.fromkeys(links))[:5]

    for l in unique_links:
        print("➡️", l)


def whatsapp_check(number):
    print("\n📱 בדיקת WhatsApp:")
    num = number.replace("0", "972", 1)
    print(f"https://wa.me/{num}")


def main():
    if len(sys.argv) < 2:
        print("שימוש: python finder.py 052XXXXXXXX")
        return

    number = sys.argv[1]

    search_google(number)
    whatsapp_check(number)


if __name__ == "__main__":
    main()
