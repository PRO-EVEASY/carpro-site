import requests

def check_phone_with_api(api_key, phone_number):
    # כתובת ה-API של Numverify
    url = f"http://apilayer.net{api_key}&number={phone_number}&country_code=IL&format=1"
    
    try:
        response = requests.get(url)
        data = response.json()
        
        if data.get("valid"):
            print(f"\n✅ תוצאות עבור: {data['international_format']}")
            print(f"---------------------------")
            print(f"🏢 מפעיל: {data['carrier']}")
            print(f"📞 סוג קו: {data['line_type']} (Mobile/Landline)")
            print(f"🌍 מדינה: {data['country_name']}")
            print(f"📍 מיקום: {data['location']}")
            print(f"---------------------------")
        else:
            print("❌ השירות לא הצליח לאמת את המספר או שהמפתח לא תקין.")
            
    except Exception as e:
        print(f"שגיאת התחברות: {e}")

# המפתח והמספר שלך
MY_KEY = "44188becf206ac095f024780d29f90e095f024780d29f90e4" # המפתח שהדבקת
PHONE = "972527669479"

check_phone_with_api(MY_KEY, PHONE)
