from django.http import HttpResponse, JsonResponse
from ldap3 import *
import json, random 
from django.contrib.auth.models import User, Group
import datetime, openpyxl

from passlib.hash import ldap_md5

from rest_framework.response import Response
from rest_framework.decorators import api_view
from .serializers import UserSerializer, GroupSerializer

from .models import UserDetail
from . import urls

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
    # server = Server('ldap://120.126.23.245:31979')
    server = Server('ldap://' + urls.LDAP_IP + ':' + urls.LDAP_PORT)
    conn = Connection(server, user='cn=admin,dc=example,dc=org', password='Not@SecurePassw0rd', auto_bind=True)
    return conn

@api_view(['GET'])
def lab_list(request):
    group_object = Group.objects.all()
    group_list = []
    for group in group_object:
        if group.name != 'root':
            group_list.append(group.name)
    return Response(group_list, status=200)

@api_view(['GET'])
def user_list(request):
    User_object = User.objects.all()
    user_list = []
    for user in User_object:
        user_list.append(user.username)
    # remote root user
    User_object = User.objects.filter(groups=Group.objects.get(name='root'))
    for user in User_object:
        user_list.remove(user.username)
    return Response(user_list, status=200)


@api_view(['POST'])
def get_group_corresponding_user(request):
    synchronize_db_ldap()
    data = json.loads(request.body.decode('utf-8'))
    user = data['user']
    group_list = []
    user_obj = User.objects.get(username=user)
    detail_obj = UserDetail.objects.filter(uid=user_obj.id)
    print(len(detail_obj))
    if len(detail_obj) == 1:
        print(detail_obj[0].permission)
        if detail_obj[0].permission == 0:
            for group in Group.objects.all():
                User.objects.filter(groups=group)
                user_list = []
                for user in User.objects.filter(groups=group):
                    user_list.append(user.username)
                group_list.append({"group_dn": group.name, "member_uids": user_list})
            return Response(group_list, status=200)
        elif detail_obj[0].permission == 1:
            # get only the group that user is in
            for group_item in detail_obj:
                User.objects.filter(groups=group_item.labname)
                user_list = []
                for user in User.objects.filter(groups=group_item.labname):
                    user_list.append(user.username)
                group_list.append({"group_dn": group_item.labname.name, "member_uids": user_list})
            return Response(group_list, status=200)
    else:
        for group_item in detail_obj:
            User.objects.filter(groups=group_item.labname)
            user_list = []
            for user in User.objects.filter(groups=group_item.labname):
                user_list.append(user.username)
            group_list.append({"group_dn": group_item.labname.name, "member_uids": user_list}) 
        return Response(group_list, status=200)            

def get_all_user_permission(user, labname):
    memberuid = {}
    ## get from database
    for user in user:
        User.objects.get(username=user)
        try:
            memberuid[user] = get_permission(user, labname)
        except:
            memberuid[user] = "user"     
    return memberuid
    
@api_view(['POST'])
def get_lab_info(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    ### get the group info from database
    group = Group.objects.get(name=labname)
    ### get the user info from database
    user_list = []
    for user in User.objects.filter(groups=group):
        user_list.append(user.username)
    ### get the user permission from database
    data = {
        "labname": labname,
        "gidNumber": group.id,
        "memberUid": get_all_user_permission(user_list, labname)
    }
    """
            data = {
                "cn": entry.cn.value,
                "gidNumber": entry.gidNumber.value,
                "memberUid": get_all_user_permission(entry.memberUid.values, labname)
            }
    """
    return Response(data, status=200)

@api_view(['POST'])
def addlab(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    try:
        Group.objects.get(name=labname)
        return Response(status=500, data="lab is exist")
    except:
        pass
    group = Group.objects.create(name=labname)
    print("add lab {} success".format(labname))
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
    user = User.objects.create_user(username=username, password=password, first_name=firstname, last_name=lastname, email=data['email'])
    user.groups.add(Group.objects.get(name=labname))
    password = user.password
    """
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    user_dn = 'cn={},ou=users,dc=example,dc=org'.format(username),
    conn = connectLDAP()
    conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
        {'cn': username, 'givenName': username, 'sn' : username ,
        'uid': username, 'uidNumber': '2001', 'gidNumber': '1001', "mail": email,
        'homeDirectory': '/home/{}'.format(username), 'loginShell': '/bin/bash',
        'userPassword': ldap_md5.hash(password), 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
        'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
        'shadowExpire': '99999', 'Description': [labname]})
    """
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    if data['is_lab_manager'] is False:
        detail_db = UserDetail.objects.create(uid=user, permission=2, labname=Group.objects.get(name=labname))
    elif data['is_lab_manager'] is True:
        detail_db = UserDetail.objects.create(uid=user, permission=1, labname=Group.objects.get(name=labname))
    user.save()
    
    return Response(status=200)

@api_view(['POST'])
def add_admin(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    user = User.objects.get(username=username)
    user.is_superuser = True
    user.is_staff = True
    user.groups.add(Group.objects.get(name='root'))
    user.save()
    detail = UserDetail.objects.filter(uid=user.id)
    for item in detail:
        item.delete()
    UserDetail.objects.create(uid=user, permission=0, labname=Group.objects.get(name='root'))
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
    user = User.objects.get(username=user)
    # get current group
    group_list = []
    for group in user.groups.all():
        ## add permission and groupname into list
        group_list.append({"permission": get_permission(user.username, group.name), "groupname": group.name})
    return group_list

        
    #return group_list

@api_view(['POST'])
def get_user_info(request):
    data = json.loads(request.body.decode('utf-8'))
    user_obj = User.objects.get(username=data['username'])
    detail_obj = UserDetail.objects.filter(uid=user_obj.id)
    data = {
        "username": user_obj.username,
        "first_name": user_obj.first_name,
        "last_name": user_obj.last_name,
        "email": user_obj.email,
        "permission": get_user_all_permission(user_obj.username),
    }
    return Response(data, status=200)

@api_view(['POST'])
def user_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    conn = connectLDAP()
    try:
        conn.delete('cn={},ou=users,dc=example,dc=org'.format(username))
    except:
        pass
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
    # delete the group from database
    Group.objects.get(name=labname).delete()
    
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


@api_view(['POST'])
def change_password(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    password = data['password']
    # change password in database
    user = User.objects.get(username=username)
    # check the password is valid or not
    if user.check_password(password) is not True:
        return JsonResponse({'message': 'password is not valid'}, status=400)
    user.set_password(password)
    user.save()
    return Response(status=200)

@api_view(['POST'])
def change_user_info(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    firstname = data['firstname']
    lastname = data['lastname']
    email = data['email']
    permission = data['permission']
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
        """
        permission : [
            {
                "groupname": "PUtest",
                "permission": "admin"
            },
            {
                "groupname": "PUtest2",
                "permission": "admin"
            }
        ]
        """
        for permission_obj in permission:
            # check the permission is same or not
            if permission_obj['permission'] == get_permission(username, permission_obj['groupname']):
                pass
            else:
                # change the permission
                detail_obj = UserDetail.objects.get(uid=User.objects.get(username=username).id, labname=Group.objects.get(name=permission_obj['groupname']))
                if permission_obj['permission'] == 'admin':
                    detail_obj.permission = 1
                elif permission_obj['permission'] == 'user':
                    detail_obj.permission = 2
                detail_obj.save()
        return Response(status=200)
    except:
        return Response(status=500)


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
            if row[0].value == "Username":
                continue
            
            # if there is any empty value
            for item in row:
                if item.value == None:
                    return JsonResponse({'message': 'excel format is not valid'}, status=400)
            # check the permission is valid or not
            if row[6].value != 'admin' and row[6].value != 'user' and row[6].value != 'root':
                return JsonResponse({'message': 'user {} permission is not valid'.format(row[0].value)}, status=400)
            # password is or not valid(all integer)
            if isinstance(row[2].value, int) is True:
                return JsonResponse({'message': 'user {} password is not valid'.format(row[0].value)}, status=400)
            # check the user is exist or not
        
        for row in worksheet.iter_rows():
            if User.objects.filter(username=row[0].value).exists() is True:
                # check the user is in the group or not
                for group_obj in User.objects.get(username=row[0].value).groups.all():
                    if group_obj.name == row[1].value:
                        # check password is correct or not
                        if User.objects.get(username=row[0].value).check_password(row[2].value) is False:
                            if User.objects.get(username=row[0].value).password == row[2].value:
                                print("user {} password is correct".format(row[0].value))
                                continue
                            user_obj_password = User.objects.get(username=row[0].value)
                            print(user_obj_password.set_password(row[2].value))
                            user_obj_password.save()
                            print("user {} password is not correct, change password to {}".format(row[0].value, row[2].value))
                        break
                continue
            # add user into django
            user_obj = User.objects.create_user(username=row[0].value, password=row[2].value, first_name=row[4].value, last_name=row[5].value, email=row[3].value)
            user_obj.save()
            # add user into group
            user_obj.groups.add(Group.objects.get(name=row[1].value))
            # add user into ldap
            group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(row[1].value)
            user_dn = 'cn={},ou=users,dc=example,dc=org'.format(row[0].value),
            conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
                {'cn': row[0].value, 'givenName': row[4].value, 'sn' : row[5].value ,
                'uid': row[0].value, 'uidNumber': '2001', 'gidNumber': '1001', "mail": row[3].value,
                'homeDirectory': '/home/{}'.format(row[0].value), 'loginShell': '/bin/bash',
                'userPassword': ldap_md5.hash(row[2].value), 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
                'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                'shadowExpire': '99999', 'Description': [row[1].value]})
            # add user into database
            if row[6].value == 'admin':
                UserDetail.objects.create(uid=user_obj, permission=1, labname=Group.objects.get(name=row[1].value))
            elif row[6].value == 'user':
                UserDetail.objects.create(uid=user_obj, permission=2, labname=Group.objects.get(name=row[1].value))
            print("add user {} success".format(row[0].value))
        return Response(status=200)
    else:
        return Response(status=500)
    

def get_permission(user, group):
    print(user, group)
    try:
        detail_obj = UserDetail.objects.get(uid=User.objects.get(username=user).id, labname=Group.objects.get(name=group))
    except:
        return "user"
    # if user is not in the group, return 0
    if detail_obj.permission == 0:
        return "root"
    elif detail_obj.permission == 1:
        return "admin"
    elif detail_obj.permission == 2:
        return "user"

@api_view(['GET'])
def export_ldap(request):
    user_list = []
    user_list.append(["Username","Group","password","email", "firstname", "lastname", "permission"])
    # export the user in the group from database
    for user in User.objects.all():
        for group in user.groups.all():
            user_list.append([user.username, group.name, user.password, user.email, user.first_name, user.last_name, get_permission(user.username, group.name)])
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
    user_all_obj = User.objects.all()
    outside_user = []
    for user in user_all_obj:
        if user.groups.filter(name=lab).exists() is False:
            outside_user.append(user.username)
    return Response(outside_user, status=200)

@api_view(['POST'])
def add_user_to_lab(request):
    data = json.loads(request.body.decode('utf-8'))
    lab = data['lab']
    user = data['user']
    check = data['admin']
    user_obj = User.objects.get(username=user)
    print(user_obj)
    if check is True:
        try:
            UserDetail.objects.create(uid=user_obj, permission=1, labname=Group.objects.get(name=lab))
            user_obj.groups.add(Group.objects.get(name=lab))
            return Response(status=200)
        except:
            return Response(status=500)
    else:
        try:
            UserDetail.objects.create(uid=user_obj, permission=2, labname=Group.objects.get(name=lab))
            user_obj.groups.add(Group.objects.get(name=lab))
            return Response(status=200)
        except:
            return Response(status=500)

@api_view(['POST'])
def export_lab_user(request):
    data = json.loads(request.body.decode('utf-8'))
    lab = data['lab']

    user_list = []
    user_list.append(["Username","password","email", "firstname", "lastname", "permission"])
    # export the user in the group from database
    for user in User.objects.filter(groups=Group.objects.get(name=lab)):
        user_list.append([user.username, user.password, user.email, user.first_name, user.last_name, get_permission(user.username, lab)])
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

import pandas
@api_view(['POST'])
def import_lab_user(request):
    group = request.POST['lab']
    print(group)
    if request.FILES.get('file'):
        excel_file = request.FILES['file']
        conn = connectLDAP()
        with open('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name, 'wb+') as destination:
            for chunk in excel_file.chunks():
                destination.write(chunk)
        # read and pritn the excel file, attribute ["Username","password","email", "firstname", "lastname", "permission"]
        worksheet = openpyxl.load_workbook('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name).active
        # intialize check all false
        # check all data is valid or not with database, use pandas
        for row in worksheet.iter_rows():
            if row[0].value == "Username":
                continue
            ## if there is any data is null, return error
            for item in row:
                if item.value == None:
                    return JsonResponse({'message': 'excel format is not valid'}, status=400)
            if row[5].value != 'admin' and row[5].value != 'user':
                return JsonResponse({'message': 'user {} permission is not valid'.format(row[0].value)}, status=400)
            # password is or not valid(all integer)
            if isinstance(row[1].value, int) is True:
                return JsonResponse({'message': 'user {} password is not valid'.format(row[0].value)}, status=400)
        # add user into django
        for row in worksheet.iter_rows():
            if row[0].value == "Username":
                    continue
            # if user is exist and in correct group, skip
            user_corresponding_group = False
            if User.objects.filter(username=row[0].value).exists() is True:
                for group_obj in User.objects.get(username=row[0].value).groups.all():
                    if group_obj.name == group:
                        user_corresponding_group = True
                        # check password is correct or not
                        print(User.objects.get(username=row[0].value).check_password(row[1].value), row[1].value)
                        if User.objects.get(username=row[0].value).check_password(row[1].value) is False:
                            if User.objects.get(username=row[0].value).password == row[1].value:
                                print("user {} password is correct".format(row[0].value))
                                continue
                            user_obj_password = User.objects.get(username=row[0].value)
                            print(user_obj_password.set_password(row[1].value))
                            user_obj_password.save()
                            print("user {} password is not correct, change password to {}".format(row[0].value, row[1].value))
                        break
                if user_corresponding_group is True:
                    continue
                else:
                    # add user into corresponding group
                    User.objects.get(username=row[0].value).groups.add(Group.objects.get(name=group))
                    if row[5].value == 'admin':
                        UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=1, labname=Group.objects.get(name=group))
                    else:
                        UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=2, labname=Group.objects.get(name=group))
                    
            
            # add new user into django
            user = User.objects.create_user(username=row[0].value, password=row[1].value, first_name=row[3].value, last_name=row[4].value, email=row[2].value)
            user.groups.add(Group.objects.get(name=group))
            if row[5].value == 'admin':
                UserDetail.objects.create(uid=user, permission=1, labname=Group.objects.get(name=group))
            else:
                UserDetail.objects.create(uid=user, permission=2, labname=Group.objects.get(name=group))
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

@api_view(['POST'])
def remove_user_from_lab(request):
    data = json.loads(request.body.decode('utf-8'))
    user = data['user']
    lab = data['lab']
    # remove user from group in database
    try:
        User.objects.get(username=user).groups.remove(Group.objects.get(name=lab))
        UserDetail.objects.get(uid=User.objects.get(username=user).id, labname=Group.objects.get(name=lab)).delete()
        return Response(status=200)
    except:
        return Response(status=500)
    
    
def synchronize_db_ldap():
    conn = connectLDAP()
    group_obj = Group.objects.all()
    for group in group_obj:
        if conn.search('cn={},ou=Groups,dc=example,dc=org'.format(group.name), '(objectclass=posixGroup)', attributes=['*']) is False:
            #print("group {} is not exist".format(group.name))
            conn.add('cn={},ou=Groups,dc=example,dc=org'.format(group.name), ['posixGroup', 'top'], {'cn': ['{}'.format(group.name)], 'gidNumber': ['{}'.format(10001)]})
        """
        else:
            print("group {} is exist".format(group.name))
        """
    user_obj = User.objects.all()
    for user in user_obj:
        if conn.search('cn={},ou=users,dc=example,dc=org'.format(user.username), '(objectclass=posixAccount)', attributes=['*']) is False:
            conn.add('cn={},ou=users,dc=example,dc=org'.format(user.username), ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
                {'cn': user.username, 'givenName': user.username, 'sn' : user.username ,
                'uid': user.username, 'uidNumber': '2001', 'gidNumber': '1001', "mail": user.email,
                'homeDirectory': '/home/{}'.format(user.username), 'loginShell': '/bin/bash',
                'userPassword': user.password.split('$')[1], 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999',
                'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                'shadowExpire': '99999', 'Description': [group.name]})
            """
        else:
            print("user {} is exist".format(user.username))
            """
        # set all user with password in database
        conn.modify('cn={},ou=users,dc=example,dc=org'.format(user.username), {'userPassword': [(MODIFY_REPLACE, [user.password.split('$')[1]])]})
        for group in user.groups.all():
            #print("add user {} into group {}".format(user.username, group.name))
            conn.search('cn={},ou=Groups,dc=example,dc=org'.format(group.name), '(objectclass=posixGroup)', attributes=['*'])
            conn.modify('cn={},ou=Groups,dc=example,dc=org'.format(group.name), {'memberUid': [(MODIFY_ADD, [user.username])]})
    for detail_obj in UserDetail.objects.all():
        conn.search('cn={},ou=users,dc=example,dc=org'.format(detail_obj.uid.username), '(objectclass=posixAccount)', attributes=['Description'])
        for entry in conn.entries:
            conn.description = detail_obj.labname.name
    conn.unbind()
    return True
@api_view(['POST'])
def multiple_user_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    users = data['users']
    conn = connectLDAP()
    for user in users:
        User.objects.get(username=user).delete()
        conn.delete('cn={},ou=users,dc=example,dc=org'.format(user))
        # remove from group entry
        conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
        for entry in conn.entries:
            try:
                conn.modify(entry.entry_dn, {'memberUid': [(MODIFY_DELETE, [user])]})
            except:
                pass
    return Response(status=200)

@api_view(['POST'])
def remove_multiple_user_from_lab(request):
    data = json.loads(request.body.decode('utf-8'))
    group = data['group']
    users = data['users']
    conn = connectLDAP()
    for user in users:
        User.objects.get(username=user).groups.remove(Group.objects.get(name=group))
        UserDetail.objects.get(uid=User.objects.get(username=user).id, labname=Group.objects.get(name=group)).delete()
        conn.search('dc={},ou=Groups,dc=example,dc=org'.format(group), '(objectclass=posixGroup)', attributes=['*'])
        for entry in conn.entries:
            try:
                conn.modify(entry.entry_dn, {'memberUid': [(MODIFY_DELETE, [user])]})
            except:
                pass
        # remove user description about group
        conn.search('dc={},ou=users,dc=example,dc=org'.format(user), '(objectclass=posixAccount)', attributes=['Description'])
        for entry in conn.entries:
            conn.modify(entry.entry_dn, {'Description': [(MODIFY_DELETE, [group])]})
    return Response(status=200)

@api_view(['GET'])
def remove_all_entr(request):
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    for entry in conn.entries:
        conn.delete(entry.entry_dn)
    conn.search('dc=example,dc=org', '(objectclass=posixAccount)', attributes=['cn'])
    for entry in conn.entries:
        conn.delete(entry.entry_dn)
    conn.unbind()
    return Response(status=200)
