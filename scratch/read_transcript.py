import json

log_path = r"C:\Users\mario\.gemini\antigravity\brain\12ed399c-9123-45d9-adac-f36fd8b25d85\.system_generated\logs\transcript.jsonl"

user_messages = []
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("source") == "USER_EXPLICIT" and data.get("type") == "USER_INPUT":
                user_messages.append((data.get("step_index"), data.get("created_at"), data.get("content")))
        except Exception as e:
            pass

for step, time, content in user_messages[-10:]:
    print(f"Step {step} | {time}:")
    print(content)
    print("-" * 50)
