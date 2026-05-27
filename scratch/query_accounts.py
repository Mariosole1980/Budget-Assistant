import urllib.request
import json

url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1/accounts?user_id=eq.c13f513d-b588-472b-86f8-2f5c1227dd13'
headers = {
    'apikey': 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp',
    'Authorization': 'Bearer sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp'
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read()
        data = json.loads(html)
        print("ACCOUNTS:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
