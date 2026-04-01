def search_google(number):
    print(f"\n🔍 מחפש בגוגל: {number}\n")

    query = urllib.parse.quote(number)
    url = f"https://www.google.com/search?q={query}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
        "Accept-Language": "en-US,en;q=0.9"
    }

    r = requests.get(url, headers=headers)

    print("📡 סטטוס:", r.status_code)

    soup = BeautifulSoup(r.text, "html.parser")

    results = soup.select("a")

    found = False

    for link in results:
        href = link.get("href")
        if href and "/url?q=" in href:
            clean = href.split("/url?q=")[1].split("&")[0]
            if "google" not in clean:
                print("➡️", clean)
                found = True

    if not found:
        print("❌ לא נמצאו תוצאות (כנראה חסימה של גוגל)")
