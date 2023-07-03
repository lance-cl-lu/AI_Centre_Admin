from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from ldap3 import *
import json, re
from .models import User

from rest_framework.parsers import JSONParser
from .serializers import UserSerializer

@csrf_exempt
def syschronize_ldap(requset):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    print(conn.entries)
    group_list = []
    for entry in conn.entries:
        print(entry.entry_dn)
        group_list.append(entry.entry_dn)
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    print(conn.entries)
    account_list = []
    for entry in conn.entries:
        print(entry.entry_gidNumber)
        account_list.append(entry.entry_gidNumber)
        conn.unbind()
    # get the user with corresponding group
    
    return JsonResponse({'group_list': group_list, 'account_list': account_list}, status=200)

# Create your views here.
@csrf_exempt
def user_list(request):
    if request.method == 'GET':
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return JsonResponse(serializer.data, safe=False)

@csrf_exempt
def user_detail(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return HttpResponse(status=404)
    
    if request.method == 'GET':
        serializer = UserSerializer(user)
        return JsonResponse(serializer.data)
    elif request.method == 'PUT':
        data = JSONParser().parse(request)
        serializer = UserSerializer(user, data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data)
        return JsonResponse(serializer.error, status=400)

    elif request.method == 'DELETE':
        user.delete()
        return HttpResponse(status=204)


# connect to LDAP server
def connectLDAP():
    server = Server('ldap://120.126.23.245:31979')
    conn = Connection(server, user='cn=admin,dc=example,dc=org', password='Not@SecurePassw0rd', auto_bind=True)
    return conn

def userQuery(requset):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=person)', attributes=['cn'])
    print(conn.entries)
    dn_list = []
    for entry in conn.entries:
        print(entry.entry_dn)
        dn_list.append(entry.entry_dn)
        conn.unbind()
    # return with json
    return JsonResponse(dn_list, safe=False)

def userAdd(request):
    data = json.loads(request.body, encoding='utf-8')
    conn = connectLDAP()
    # add user in ldap
    new_entry = {
        'objectClass': ['top', 'person'],
        'cn': 'John Doe',
        'sn': 'Doe',
        'givenName': 'John',
        'mail': 'johndoe@example.com',
        'userPassword': 'secretpassword'
    }

    # Add the entry to the LDAP directory
    conn.add('uid=johndoe,ou=users,dc=example,dc=org', attributes=new_entry)