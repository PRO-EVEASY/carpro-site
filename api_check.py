import requests

# הנתונים שלך
api_key = "44188becf206ac095f024780d29f90e4"
phone_number = "972527669479"

# בניית הכתובת לפי התיעוד בתמונה
url = f"http://apilayer.net{api_key}&number={phone_number}"

try:
    response = requests.get(url)
    data = response.json()

    if data.get("valid"):
        print(f"\n✅ המספר תקין!")
        print(f"---------------------------")
        print(f"📞 מספר מלא: {data.get('international_format')}")
        print(f"🏢 מפעיל: {data.get('carrier')}")
        print(f"🌍 מדינה: {data.get('country_name')}")
        print(f"📱 סוג קו: {data.get('line_type')}")
        print(f"📍 מיקום: {data.get('location')}")
        print(f"---------------------------")
    else:
        print("❌ שגיאה: המספר לא נמצא או שהמפתח לא תקין.")
        print(f"פירוט שגיאה: {data.get('error')}")

except Exception as e:
    print(f"ארעה שגיאה בחיבור: {e}")

