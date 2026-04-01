import requests

api_key = "44188becf206ac095f024780d29f90e4"
phone_number = "972527669479"

# שים לב למבנה המדויק כאן:
url = f"http://apilayer.net{api_key}&number={phone_number}"

try:
    response = requests.get(url)
    data = response.json()

    if data.get("valid"):
        print(f"\n✅ התחברות הצליחה!")
        print(f"🏢 מפעיל: {data.get('carrier')}")
        print(f"📱 סוג: {data.get('line_type')}")
    else:
        print("❌ המפתח או המספר לא תקינים.")
        print(data) # זה ידפיס את השגיאה המדויקת מהשרת
except Exception as e:
    print(f"שגיאה: {e}")
