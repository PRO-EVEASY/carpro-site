from googlesearch import search
import requests
from bs4 import BeautifulSoup

def lookup_name_on_web(phone_number):
    print(f"🔎 מחפש עקבות עבור {phone_number} ברשת...")
    
    # חיפוש המספר בפורמטים שונים כדי למקסם תוצאות
    queries = [phone_number, f'"{phone_number}"', phone_number.replace("972", "0")]
    
    found_links = []
    for q in queries:
        for url in search(q, num_results=5, lang="he"):
            if url not in found_links:
                found_links.append(url)

    if not found_links:
        print("❌ לא נמצאו אזכורים גלויים למספר הזה בגוגל.")
        return

    print(f"\n✨ נמצאו {len(found_links)} מקורות פוטנציאליים:")
    for link in found_links:
        try:
            # שליפת כותרת האתר כדי לראות אם השם מופיע שם
            res = requests.get(link, timeout=5)
            soup = BeautifulSoup(res.text, 'html.parser')
            title = soup.title.string.strip() if soup.title else "אין כותרת"
            print(f"- {title}\n  🔗 {link}\n")
        except:
            print(f"- [לא ניתן לטעון] 🔗 {link}")

# הרצה על המספר שלך
lookup_name_on_web("0527669479")

