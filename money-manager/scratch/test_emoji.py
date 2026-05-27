def stripLeadingEmoji(s):
    if not s:
        return ''
    i = 0
    codes = [ord(char) for char in s]
    while i < len(codes):
        c = codes[i]
        # High surrogate
        if 0xD800 <= c <= 0xDBFF:
            i += 2
            while i < len(codes) and codes[i] == 0x20:
                i += 1
        # BMP private use area
        elif 0xE000 <= c <= 0xF8FF:
            i += 1
            while i < len(codes) and codes[i] == 0x20:
                i += 1
        # BMP symbols / dingbats (like U+2764 heart, etc.)
        elif 0x2600 <= c <= 0x27BF:
            i += 1
            while i < len(codes) and codes[i] == 0x20:
                i += 1
        # Variation selector or replacement char
        elif c == 0xFFFD or (0xFE00 <= c <= 0xFE0F):
            i += 1
            while i < len(codes) and codes[i] == 0x20:
                i += 1
        else:
            break
    return s[i:].strip()

tests = [
    "❤️ ΥΓΕΙΑ",
    "🏡 ΣΠΙΤΙ",
    "🛒 ΔΙΑΤΡΟΦΗ",
    "🏠ΓΡΑΦΕΙΟ Β2",
    "🚗 ΑΥΤΟΚΙΝΗΤΟ",
    "🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ",
    "🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ",
    "🏋️ΓΥΜΝΑΣΤΗΡΙΟ",
    "👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ",
    "🚇 ΜΕΤΑΚΙΝΗΣΗ",
    "🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ",
    "🎬 ΣΥΝΔΡΟΜΕΣ",
    "🎓 ΕΚΠΑΙΔΕΥΣΗ"
]

for t in tests:
    print(f'"{t}" => "{stripLeadingEmoji(t)}"')
