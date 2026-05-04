import requests
import json

url = "http://localhost:8000/api/v1/skills/"
# Replace with a valid token if needed, or just see the 422 vs 401
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN_HERE" # Need a way to get this
}

payload = {
    "name": "Test Skill",
    "description": "Test Description",
    "content": "# Test Content",
    "is_template": False
}

response = requests.post(url, json=payload)
print(f"Status Code: {response.status_code}")
print(f"Response Body: {response.text}")
