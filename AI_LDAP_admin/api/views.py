from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from ldap3 import *
import json, re, random 
from django.contrib.auth.models import User, Group

import base64
from passlib.hash import ldap_md5_crypt

from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.decorators import api_view
from .serializers import UserSerializer, GroupSerializer

salt = 'cguadmin'

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

@api_view(['POST'])
def lab_list(request):
    data = json.loads(request.body.decode('utf-8'))
    user = data['user']
    group_list = []
    if user == 'root':
        conn = connectLDAP()
        conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
        for entry in conn.entries:
            group_list.append(entry.cn.value)
        conn.unbind()
    else:
        # check the user permission is one of the lab admin, return the lab name, in which the user is admin
        conn = connectLDAP()
        user_dn = 'cn={},ou=users,dc=example,dc=org'.format(user)
        conn.search(user_dn, '(objectclass=posixAccount)', attributes=['Description'])
        for entry in conn.entries:
            permission_list = entry.Description.values
            if entry.Description.values == 'root':
                return Response(['root'], status=200)
            for permission in permission_list:
                if re.match(r'.*admin', str(permission)):
                    group_list.append(permission[:-5])
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
    return Response(user_list, status=200)


@api_view(['POST'])
def get_group_corresponding_user(request):
    # get all group and corresponding user
    data = json.loads(request.body.decode('utf-8'))
    user = data['user']
    conn = connectLDAP()
    user_dn = 'cn={},ou=users,dc=example,dc=org'.format(user)
    conn.search(user_dn, '(objectclass=posixAccount)', attributes=['Description'])
    group_list = []
    permission_list = []
    for entry in conn.entries:
        permission_list = entry.Description.values
    for permission in permission_list:
        if (permission == 'admin'):
            # get all attributes
            conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['*'])
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
        # permission is specificed lab admin with name ex (Leeadmin)
        elif re.match(r'.*admin', str(permission)):
            labname = permission[:-5]
            conn.search('cn={},ou=Groups,dc=example,dc=org'.format(labname), '(objectclass=posixGroup)', attributes=['*'])
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
        # permission is specificed lab user with name ex (Lee)
        else:
            conn.search('cn={},ou=Groups,dc=example,dc=org'.format(permission), '(objectclass=posixGroup)', attributes=['*'])
            for entry in conn.entries:
                # get the group name and only one memberUid of this user
                group_dn = entry.cn.value
                try:
                    member_uids = [user]
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
    
    if (data['user'] == 'root'):
        conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['*'])
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

def get_all_user_permission(user, labname):
    conn = connectLDAP()
    memberuid = {}
    for i in range(len(user)):
        conn.search('cn={},ou=users,dc=example,dc=org'.format(user[i]), '(objectclass=posixAccount)', attributes=['Description'])
        for entry in conn.entries:
            permission_list = entry.Description.values
            for permission in permission_list:
                if re.match(r'.{}admin'.format(labname), str(permission)):
                    memberuid[user[i]] = "admin"
                    break
                else:
                    memberuid[user[i]] = "user"
    conn.unbind()
    return memberuid
    

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
                "memberUid": get_all_user_permission(entry.memberUid.values, labname)
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
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    conn = connectLDAP()
    conn.add('cn={},ou=Groups,dc=example,dc=org'.format(labname), ['posixGroup', 'top'], {'cn': ['{}'.format(labname)], 'gidNumber': ['1001']})
    group = Group.objects.create(name=labname)
    # add all permission to the group
    group.save()
    
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
    conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
        {'cn': username, 'givenName': username, 'sn' : username ,
        'uid': username, 'uidNumber': '2001', 'gidNumber': '1001', "mail": email,
        'homeDirectory': '/home/{}'.format(username), 'loginShell': '/bin/bash',
        'userPassword': ldap_md5_crypt.hash(password, salt=salt), 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
        'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
        'shadowExpire': '99999', 'Description': [labname]})
    user = User.objects.create_user(username=username, password=password, first_name=firstname, last_name=lastname, email=data['email'])
    if data['lab'] is not None:
        group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
        conn.modify(group_dn, {'memberUid': [(MODIFY_ADD, [username])]})
        if data['is_lab_manager'] is False:
            conn.modify(user_dn, {'Description': [(MODIFY_ADD, [labname])]})
        elif data['is_lab_manager'] is True:
            conn.modify(user_dn, {'Description': [(MODIFY_ADD, ['{}admin'.format(labname)])]})
            conn.modify(user_dn, {'Description': [(MODIFY_DELETE, [labname])]})
    conn.unbind()
    user.save()
    
    return Response(status=200)

@api_view(['POST'])
def add_admin(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    user_dn = 'cn={},ou=users,dc=example,dc=org'.format(username),
    conn = connectLDAP()
    conn.modify(user_dn, {'Description': [(MODIFY_ADD, ['root'])]})
    user = User.objects.get(username=username)
    # make user to be superuser
    user.is_superuser = True
    user.is_staff = True
    user.save()
    
    # ldap admin 
    return Response(status=200)

def syschronize_ldap(requset):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    group_list = []
    for entry in conn.entries:
        group_list.append(entry.entry_dn)
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    account_list = []
    for entry in conn.entries:
        account_list.append(entry.entry_gidNumber)
        conn.unbind()
    # get the user with corresponding group
    
    return JsonResponse({'group_list': group_list, 'account_list': account_list}, status=200)

def get_user_all_permission(user):
    conn = connectLDAP()
    # get add group permission
    conn.search('cn={},ou=users,dc=example,dc=org'.format(user), '(objectclass=posixAccount)', attributes=['*'])
    user_permissions = {}  # Dictionary to store user permissions
    for entry in conn.entries:
        if entry.Description is not None:
            for permission in entry.Description.values:
                if re.match(r'.*admin', str(permission)):
                    user_permissions[permission[:-5]] = "admin"
                else:
                    user_permissions[permission] = "user"
    conn.unbind()
    return user_permissions



@api_view(['POST'])
def get_user_info(request):
    data = json.loads(request.body.decode('utf-8'))
    conn = connectLDAP()
    conn.search('cn={},ou=users,dc=example,dc=org'.format(data['username']), '(objectclass=posixAccount)', attributes=['*'])

    data = {
        "username": conn.entries[0].cn.value,
        "first_name": conn.entries[0].givenName.value,
        "last_name": conn.entries[0].sn.value,
        "email": conn.entries[0].mail.value,
        "permission": get_user_all_permission(conn.entries[0].cn.value),
    }
    return Response(data, status=200)    

@api_view(['POST'])
def user_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    conn = connectLDAP()
    conn.delete('cn={},ou=users,dc=example,dc=org'.format(username))
    ## delete the user memberUID from the group
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    for entry in conn.entries:
        try:
            conn.modify(entry.entry_dn, {'memberUid': [(MODIFY_DELETE, [username])]})
        except:
            pass
    User.objects.get(username=username).delete()
    return Response(status=200)

@api_view(['POST'])
def lab_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    conn = connectLDAP()
    # delet the user if user is only in this group
    try:
        conn.search('cn={},ou=Groups,dc=example,dc=org'.format(labname), '(objectclass=posixGroup)', attributes=['memberUid'])
        for entry in conn.entries:
            member_uids = entry.memberUid.values
            # if description only one, delete the user
            conn.search('cn={},ou=users,dc=example,dc=org'.format(member_uids[0]), '(objectclass=posixAccount)', attributes=['Description'])
            for entry in conn.entries:
                if len(entry.Description.values) == 1:
                    conn.delete('cn={},ou=users,dc=example,dc=org'.format(member_uids[0]))
                    User.objects.get(username=member_uids[0]).delete()
                else: # remove the group name from description
                    conn.modify('cn={},ou=users,dc=example,dc=org'.format(member_uids[0]), {'Description': [(MODIFY_DELETE, [labname])]})
                    conn.modify('cn={},ou=users,dc=example,dc=org'.format(member_uids[0]), {'Description': [(MODIFY_DELETE, ['{}admin'.format(labname)])]})
        # delete the group
        conn.delete('cn={},ou=Groups,dc=example,dc=org'.format(labname))
    except:
        return Response(status=500)
    return Response(status=200)

    
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
    data = {'lab_num': len(group_list), 'lab_list': group_list, 'user_num': len(user_list), 'user_list': user_list}
    return JsonResponse(data, safe=False)


@api_view(['POST'])
def add_lab_admin(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    labname = data['lab']
    User.objects.get(username=username).is_staff = True
    conn = connectLDAP()
    lab = conn.search('cn={},ou=Groups,dc=example,dc=org'.format(labname), '(objectclass=posixGroup)', attributes=['cn'])
    user = conn.search('cn={},ou=users,dc=example,dc=org'.format(username), '(objectclass=posixAccount)', attributes=['*'])
    for entry in user.entries:
        conn.modify(entry.entry_dn, {'Description': [(MODIFY_ADD, ['{}admin'.format(labname)])]})
    conn.unbind()

@api_view(['GET'])
def synchronize(request):
    # use to check if ldap and django data same
    conn = connectLDAP()

@api_view(['POST'])
def change_password(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    password = data['password']
    conn = connectLDAP()
    conn.search('cn={},ou=users,dc=example,dc=org'.format(username), '(objectclass=posixAccount)', attributes=['*'])
    try:
        for entry in conn.entries:
            conn.modify(entry.entry_dn, {'userPassword':[(MODIFY_REPLACE, [ldap_md5_crypt.hash(password, salt=salt)])]})
        conn.unbind
        user = User.objects.get(username=username)
        user.set_password(password)
        user.save()
        return Response(status=200)
    except:
        return Response(status=500)

@api_view(['POST'])
def change_user_info(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    firstname = data['firstname']
    lastname = data['lastname']
    email = data['email']
    try:
        conn = connectLDAP()
        conn.search('cn={},ou=users,dc=example,dc=org'.format(username), '(objectclass=posixAccount)', attributes=['*'])
        for entry in conn.entries:
            conn.modify(entry.entry_dn, {'givenName':[(MODIFY_REPLACE, [firstname])]})
            conn.modify(entry.entry_dn, {'sn':[(MODIFY_REPLACE, [lastname])]})
            conn.modify(entry.entry_dn, {'mail': [(MODIFY_REPLACE, [email])]})
        user = User.objects.get(username=username)
        user.first_name = firstname
        user.last_name = lastname
        user.email = email
        user.save()
        return Response(status=200)
    except:
        return Response(status=500)

import datetime, openpyxl

@api_view(['POST'])
def excel(request):
    if request.FILES.get('file'):
        excel_file = request.FILES['file']
        user = request.POST['user']
        print(user)
        conn = connectLDAP()
        with open('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name, 'wb+') as destination:
            for chunk in excel_file.chunks():
                destination.write(chunk)
        # read and pritn the excel file, attribute ["Username","Group","password","email", "firstname", "lastname", "permission"]
        worksheet = openpyxl.load_workbook('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name).active
        for row in worksheet.iter_rows():
            # if first row, skip
            if row[0].value == "Username":
                continue
            # check the user is exist or not
            # if user exist and in correct group, skip
            user_corresponding_group = False
            if conn.search('cn={},ou=users,dc=example,dc=org'.format(row[0].value), '(objectclass=posixAccount)', attributes=['*']) is True:
                for entry in conn.entries:
                    if conn.search('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), '(objectclass=posixGroup)', attributes=['memberUid']) is True:
                        for entry in conn.entries:
                            if row[0].value in entry.memberUid.values:
                                user_corresponding_group = True
                                break
            if user_corresponding_group is True:
                print("user {} is exist and in correct group".format(row[0].value))
                continue
            print(row[0].value)
            if conn.search('cn={},ou=users,dc=example,dc=org'.format(row[0].value), '(objectclass=posixAccount)', attributes=['*']) is False:
                # check the group is exist or not
                print("user {} is not exist".format(row[0].value))
                if conn.search('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), '(objectclass=posixGroup)', attributes=['*']) is False:
                    # create the group
                    print("group {} is not exist".format(row[1].value))
                    conn.add('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), ['posixGroup', 'top'], {'cn': ['{}'.format(row[1].value)], 'gidNumber': ['{}'.format(10001)]})
                    group = Group.objects.create(name=row[1].value)
                    group.save()
                    print("create group {}".format(row[1].value))
                # create the user
                user_description = ''
                if row[6].value == 'admin':
                    user_description = '{}admin'.format(row[1].value)
                else:
                    user_description = row[1].value
                print(user_description)
                # add user info into ldap
                conn.add('cn={},ou=users,dc=example,dc=org'.format(row[0].value), ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
                    {'cn': row[0].value, 'givenName': row[0].value, 'sn' : row[0].value ,
                    'uid': row[0].value, 'uidNumber': '2001', 'gidNumber': '1001', "mail": row[3].value,
                    'homeDirectory': '/home/{}'.format(row[0].value), 'loginShell': '/bin/bash',
                    'userPassword': ldap_md5_crypt.hash(row[2].value, salt=salt), 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
                    'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                    'shadowExpire': '99999', 'Description': [user_description]})
                conn.modify('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), {'memberUid': [(MODIFY_ADD, [row[0].value])]})
                print("add user {} into group {}".format(row[0].value, row[1].value))
                # add user info into django
                user = User.objects.create_user(username=row[0].value, password=row[2].value, first_name=row[4].value, last_name=row[5].value, email=row[3].value)
                user.groups.add(Group.objects.get(name=row[1].value))
                print("add user {} into django".format(row[0].value))
            else:
                # check the group is exist or not
                print("user {} is exist".format(row[0].value))
                if conn.search('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), '(objectclass=posixGroup)', attributes=['*']) is False:
                    # create the group
                    conn.add('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), ['posixGroup', 'top'], {'cn': ['{}'.format(row[1].value)], 'gidNumber': ['{}'.format(10001)]})
                    group = Group.objects.create(name=row[1].value)
                    group.save()
                # add user info into ldap
                user_description = ''
                if row[6].value == 'admin':
                    user_description = '{}admin'.format(row[1].value)
                else:
                    user_description = row[1].value
                print(user_description)
                conn.modify('cn={},ou=users,dc=example,dc=org'.format(row[0].value), {'Description': [(MODIFY_ADD, [user_description])]})
                conn.modify('cn={},ou=Groups,dc=example,dc=org'.format(row[1].value), {'memberUid': [(MODIFY_ADD, [row[0].value])]})
                print("add user {} into group {}".format(row[0].value, row[1].value))
                # add user info into django
                user = User.objects.get(username=row[0].value)
                print("add user {} into django".format(row[0].value))
        conn.unbind()
        return JsonResponse({'message': 'File upload success'}, status=200)
    
    return JsonResponse({'message': 'File upload failed'}, status=400)

def get_permission(user, group):
    conn = connectLDAP()
    conn.search('cn={},ou=users,dc=example,dc=org'.format(user), '(objectclass=posixAccount)', attributes=['Description'])
    for entry in conn.entries:
        if re.match(r'{}admin'.format(group), str(entry.Description.value)):
            return "admin"
    return "user"
@api_view(['GET'])
def export_ldap(request):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['*'])
    user_list = []
    user_list.append(["Username","Group","password","email", "firstname", "lastname", "permission"])
    for entry in conn.entries:
        ## if group without memberUid attribute, skip
        try:
            group = entry.cn.value
            member_list = entry.memberUid.value
            
            # check group has muti user or not
            if isinstance(member_list, list):
                for member_entry in member_list:
                    conn.search('cn={},ou=users,dc=example,dc=org'.format(member_entry), '(objectclass=posixAccount)', attributes=['*'])
                    for user_entry in conn.entries:
                        user_list.append([user_entry.cn.value, group, user_entry.userPassword.value, user_entry.mail.value, user_entry.givenName.value, user_entry.sn.value, get_permission(user_entry.cn.value, group)])
            elif isinstance(member_list, str):
                conn.search('cn={},ou=users,dc=example,dc=org'.format(member_list), '(objectclass=posixAccount)', attributes=['*'])
                for user_entry in conn.entries:
                    user_list.append([user_entry.cn.value, group, user_entry.userPassword.value, user_entry.mail.value, user_entry.givenName.value, user_entry.sn.value, get_permission(user_entry.cn.value, group)])
        except:
            continue
        
    # make data to excel
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    for row in user_list:
        worksheet.append(row)
    workbook.save("data.xlsx")
    excel_file_path = 'data.xlsx'
    response = HttpResponse(content_type="application/ms-excel")
    response['Content-Disposition'] = 'attachment; filename=data.xlsx'
    workbook.save(response)
    
    return response

@api_view(['POST'])
def outside_user(request):
    data = json.loads(request.body.decode('utf-8'))
    lab = data['lab']
    conn = connectLDAP()
    conn.search('cn={},ou=Groups,dc=example,dc=org'.format(lab), '(objectclass=posixGroup)', attributes=['*'])
    user_list = []
    for entry in conn.entries:
        try:
            member_uids_entry = entry.memberUid.values
            for member_uid in member_uids_entry:
                user_list.append(member_uid)
        except:
            pass
    all_user = []
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    for entry in conn.entries:
        all_user.append(entry.cn.value)
    outside_user = list(set(all_user) - set(user_list))
    return Response(outside_user, status=200)

@api_view(['POST'])
def add_user_to_lab(request):
    data = json.loads(request.body.decode('utf-8'))
    lab = data['lab']
    user = data['user']
    conn = connectLDAP()
    try:
        conn.modify('cn={},ou=Groups,dc=example,dc=org'.format(lab), {'memberUid': [(MODIFY_ADD, [user])]})
        conn.modify('cn={},ou=users,dc=example,dc=org'.format(user), {'Description': [(MODIFY_ADD, [lab])]})
        conn.unbind()
        return Response(status=200)
    except:
        return Response(status=500)

@api_view(['POST'])
def export_lab_user(request):
    data = json.loads(request.body.decode('utf-8'))
    lab = data['lab']
    conn = connectLDAP()
    conn.search('cn={},ou=Groups,dc=example,dc=org'.format(lab), '(objectclass=posixGroup)', attributes=['*'])
    user_list = []
    user_list.append(["Username","password","email", "firstname", "lastname", "permission"])
    for entry in conn.entries:
        try:
            group = entry.cn.value
            member_list = entry.memberUid.value
            
            # check group has muti user or not
            if isinstance(member_list, list):
                for member_entry in member_list:
                    conn.search('cn={},ou=users,dc=example,dc=org'.format(member_entry), '(objectclass=posixAccount)', attributes=['*'])
                    for user_entry in conn.entries:
                        user_list.append([user_entry.cn.value, user_entry.userPassword.value, user_entry.mail.value, user_entry.givenName.value, user_entry.sn.value, get_permission(user_entry.cn.value, group)])
            elif isinstance(member_list, str):
                conn.search('cn={},ou=users,dc=example,dc=org'.format(member_list), '(objectclass=posixAccount)', attributes=['*'])
                for user_entry in conn.entries:
                    user_list.append([user_entry.cn.value, user_entry.userPassword.value, user_entry.mail.value, user_entry.givenName.value, user_entry.sn.value, get_permission(user_entry.cn.value, group)])
        except:
            continue
        
    # make data to excel
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    for row in user_list:
        worksheet.append(row)
    workbook.save("data.xlsx")
    excel_file_path = 'data.xlsx'
    response = HttpResponse(content_type="application/ms-excel")
    response['Content-Disposition'] = 'attachment; filename=data.xlsx'
    workbook.save(response)
    return response

@api_view(['POST'])
def import_lab_user(request):
    group = request.POST['lab']
    if request.FILES.get('file'):
        excel_file = request.FILES['file']
        conn = connectLDAP()
        with open('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name, 'wb+') as destination:
            for chunk in excel_file.chunks():
                destination.write(chunk)
        # read and pritn the excel file, attribute ["Username","password","email", "firstname", "lastname", "permission"]
        worksheet = openpyxl.load_workbook('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name).active
        for row in worksheet.iter_rows():
            if row[0].value == "Username":
                    continue
            # if user exist skip
            if conn.search('cn={},ou=users,dc=example,dc=org'.format(row[0].value), '(objectclass=posixAccount)', attributes=['*']) is True:
                print("user {} is exist".format(row[0].value))
                continue
            # add user info into ldap
            if row[5].value == 'admin':
                user_description = '{}admin'.format(group)
            else:
                user_description = group
            print(user_description)
            conn.add('cn={},ou=users,dc=example,dc=org'.format(row[0].value), ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
                {'cn': row[0].value, 'givenName': row[0].value, 'sn' : row[0].value ,
                'uid': row[0].value, 'uidNumber': '2001', 'gidNumber': '1001', "mail": row[2].value,
                'homeDirectory': '/home/{}'.format(row[0].value), 'loginShell': '/bin/bash',
                'userPassword': ldap_md5_crypt.hash(row[1].value, salt=salt), 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
                'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                'shadowExpire': '99999', 'Description': [user_description]})
            # add user info into django
            user = User.objects.create_user(username=row[0].value, password=row[1].value, first_name=row[3].value, last_name=row[4].value, email=row[2].value)
            conn.modify('cn={},ou=Groups,dc=example,dc=org'.format(group), {'memberUid': [(MODIFY_ADD, [row[0].value])]})
            print("add user {} into django".format(row[0].value))
        conn.unbind()
    return JsonResponse({'message': 'File upload success'}, status=200)

@api_view(['GET'])
def db_ldap_check(request):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    ldap_user = []
    for entry in conn.entries:
        ldap_user.append(entry.cn.value)
    django_user = []
    for user in User.objects.all():
        django_user.append(user.username)
    unsycho_user = list(set(ldap_user) - set(django_user))
    if unsycho_user != []:
        return Response(unsycho_user, status=200)
    return Response(status=200)