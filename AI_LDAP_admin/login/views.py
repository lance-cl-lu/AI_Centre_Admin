from django.shortcuts import render
import json, re
from django.http import HttpResponse, JsonResponse  
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

import jwt
from datetime import datetime, timedelta
from django.conf import settings

def generate_token(username):
    payload = {
        'username': username,
        'exp': datetime.utcnow() + timedelta(days=7)  # Token expiration time (e.g., 7 days)
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256').encode('utf-8').decode('utf-8')
    return token

@csrf_exempt
def login(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    password = data['password']
    user = authenticate(username=username, password=password)
    if user is not None:
        token = generate_token(username)
        print(token)
        return JsonResponse({'token': token}, status=200)
    return JsonResponse({'error': 'Invalid credentials'}, status=401)
    
    