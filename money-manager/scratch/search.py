import re

def search(filepath, term):
    print(f"Searching for '{term}' in {filepath}:")
    with open(filepath, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            if term in line:
                print(f"Line {idx+1}: {line.strip()[:100]}")

search('c:/Users/mario/Desktop/money-manager/app.js', 'DOMContentLoaded')
search('c:/Users/mario/Desktop/money-manager/app.js', 'loadOfflineData')
search('c:/Users/mario/Desktop/money-manager/app.js', 'loadData')
search('c:/Users/mario/Desktop/money-manager/app.js', 'initSupabaseAuth')
search('c:/Users/mario/Desktop/money-manager/app.js', 'updateHeaderSyncIcon')
search('c:/Users/mario/Desktop/money-manager/app.js', 'onAuthStateChange')
