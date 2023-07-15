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

@api_view(['GET'])
def getRoute(requset):
    routes = [
        '/api/user/',
        '/api/user/<str:pk>/',
        '/api/userQuery/',
        '/api/userAdd/',
        '/api/syschronize_ldap/',
    ]
    return Response(routes)

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
    firstname = data['firstname']
    lastname = data['lastname']
    password = data['password']
    labname = data['lab']
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    user_dn = 'cn={},ou=users,dc=example,dc=org'.format(username),
    conn = connectLDAP()
    conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
              {'cn': username, 'givenName': username, 'sn' : username ,
               'uid': username, 'uidNumber': '2001', 'gidNumber': '1001',
               'homeDirectory': '/home/{}'.format(username), 'loginShell': '/bin/bash',
                'userPassword': password, 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
                'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                'shadowExpire': '99999'})
    if data['lab'] is not None:
        group_dn = conn.entries[0].entry_dn
        conn.modify(group_dn, {'memberUid': [(MODIFY_ADD, [username])]})
    conn.unbind()
    user = User.objects.create_user(username=username, password=password, first_name=firstname, last_name=lastname, email=data['email'])
    user.save()
    
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