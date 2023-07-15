from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from ldap3 import *
import json, re, random 
from django.contrib.auth.models import User

from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.decorators import api_view
from .serializers import UserSerializer, GroupSerializer

def get_gid():
    while True:
        uid = random.randint(10000, 65535)  # Generate a random UID within the range of user IDs
'''        try:
            pwd.getgrgid(uid)  # Attempt to get the user entry for the generated UID
        except KeyError:
            return uid
'''
# connect to LDAP server
def connectLDAP():
    server = Server('ldap://120.126.23.245:31979')
    conn = Connection(server, user='cn=admin,dc=example,dc=org', password='Not@SecurePassw0rd', auto_bind=True)
    return conn

@api_view(['GET'])
def lab_list(request):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    group_list = []
    for entry in conn.entries:
        group_list.append(entry.cn.value)
    conn.unbind()
    return Response(group_list, status=200)

@api_view(['GET'])
def user_list(request):
    conn = connectLDAP()
    # objectclass is posixAccount and top 
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    user_list = []
    for entry in conn.entries:
        user_list.append(entry.cn.value)
    conn.unbind()
    print(user_list)
    return Response(user_list, status=200)


@api_view(['GET'])
def get_group_corresponding_user(request):
    # get all group and corresponding user
    conn = connectLDAP()
    # get all attributes
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['*'])
    group_list = []
    for entry in conn.entries:
        member_uids = []
        group_dn = entry.cn.value
        try:
            member_uids_entry = entry.memberUid.values
            for member_uid in member_uids_entry:
                member_uids.append(str(member_uid))

            # Append the group cn and corresponding memberUids
            group_list.append({
                'group_dn': group_dn,
                'member_uids': member_uids
            })
        except:
            group_list.append({
                'group_dn': group_dn,
                'member_uids': []
            })
            
    conn.unbind()

    return Response(group_list, status=200)

@api_view(['POST'])
def get_lab_info(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    conn = connectLDAP()
    conn.search('cn={},ou=Groups,dc=example,dc=org'.format(labname), '(objectclass=posixGroup)', attributes=['*'])
    data = {}
    for entry in conn.entries:
        try:
            data = {
                "cn": entry.cn.value,
                "gidNumber": entry.gidNumber.value,
                "memberUid": entry.memberUid.values
            }
        except:
            data = {
                "cn": entry.cn.value,
                "gidNumber": entry.gidNumber.value,
                "memberUid": []
            }

    conn.unbind()
    return Response(data, status=200)

@api_view(['POST'])
def addlab(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    print(labname)
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    conn = connectLDAP()
    print(conn.add('cn={},ou=Groups,dc=example,dc=org'.format(labname), ['posixGroup', 'top'], {'cn': ['{}'.format(labname)], 'gidNumber': ['1001']}))
    conn.unbind()
    return Response(status=200)

@api_view(['POST'])
def adduser(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    firstname = data['first_name']
    lastname = data['last_name']
    password = data['password']
    labname = data['lab']
    email = data['email']
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    user_dn = 'cn={},ou=users,dc=example,dc=org'.format(username),
    conn = connectLDAP()
    print(conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
              {'cn': username, 'givenName': username, 'sn' : username ,
               'uid': username, 'uidNumber': '2001', 'gidNumber': '1001', "mail": email,
               'homeDirectory': '/home/{}'.format(username), 'loginShell': '/bin/bash',
                'userPassword': password, 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
                'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                'shadowExpire': '99999'}))
    
    if data['lab'] is not None:
        group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
        conn.modify(group_dn, {'memberUid': [(MODIFY_ADD, [username])]})
    conn.unbind()
    user = User.objects.create_user(username=username, password=password, first_name=firstname, last_name=lastname, email=data['email'])
    user.save()
    
    return Response(status=200)

@api_view(['POST'])
def add_admin(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    user = User.objects.get(username=username)
    # make user to be superuser
    user.is_superuser = True
    user.is_staff = True
    user.save()
    
    # ldap admin 
    return Response(status=200)

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

@api_view(['POST'])
def get_user_info(request):
    data = json.loads(request.body.decode('utf-8'))
    conn = connectLDAP()
    conn.search('cn={},ou=users,dc=example,dc=org'.format(data['username']), '(objectclass=posixAccount)', attributes=['*'])
    user = User.objects.get(username=data['username'])
    data = {
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
    }
    return Response(data, status=200)    

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
    
def user_group_num(requset):
    conn = connectLDAP()
    group_list = []
    user_list = []
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    for entry in conn.entries:
        group_list.append(entry.cn.value)
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    for entry in conn.entries:
        user_list.append(entry.cn.value)
    conn.unbind()
    # return the number of group and user
    data = {'lab_num': len(group_list), 'user_num': len(user_list)}
    return JsonResponse(data, safe=False)

def add_excel(request):
    conn = connectLDAP()
    return render(request, 'add_excel.html')