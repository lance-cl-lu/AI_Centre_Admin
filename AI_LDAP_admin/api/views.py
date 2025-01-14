from django.http import HttpResponse, JsonResponse
from ldap3 import *
import json, random 
from django.contrib.auth.models import User, Group
import datetime, openpyxl
from django.core.files.storage import default_storage

from passlib.hash import ldap_md5

from rest_framework.response import Response
from rest_framework.decorators import api_view
from .serializers import UserSerializer, GroupSerializer

from .models import UserDetail, GroupDefaultQuota, UserGPUQuotaType
from . import urls

from kubernetes import client, config
from kubernetes.config.config_exception import ConfigException

import smtplib, ssl
from email.mime.text import MIMEText
import yaml
import zipfile


def send_email_gmail(subject, message, destination):
    # First assemble the message
    msg = MIMEText(message, 'plain')
    msg['Subject'] = subject

    # Login and send the message
    port = 465
    my_mail = 'support01@twentyfouri.com'
    my_password = 'czyq oonp vyxd inor'
    context = ssl.create_default_context() 
    with smtplib.SMTP_SSL('smtp.gmail.com', port, context=context) as server:
        server.login(my_mail, my_password)
        server.sendmail(my_mail, destination, msg.as_string())

# Define the group, version, and plural for the Profile CRD
group = 'kubeflow.org'  # CRD 的 Group
version = 'v1'            # CRD 的 Version
plural = 'profiles'       # CRD 的 Plural

def change_notebooks_persisitent(namespace, notebook, persisitent):
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    profile_data = {
        "metadata": {
            "labels": {
                "persisitent": persisitent
            }
        },
    }
    try:
        # Create an API client for the CustomResourceDefinition API
        api = client.CustomObjectsApi()

        # Get the profile
        notebook = api.patch_namespaced_custom_object(group, version, namespace, "notebooks", notebook, body=profile_data)
        return notebook
    except Exception as e:
        print(f"An error occurred: {e}")
        return None
    
@api_view(['POST'])
def set_notebook(request):
    data = json.loads(request.body.decode('utf-8'))
    user = data['user']
    notebookName = data['notebookName']
    persisitent = data['persisitent']

    user_obj = User.objects.get(username=data['user'])
    profileName = get_profile_by_email(user_obj.email)
    print("profileName = ", profileName)
    change_notebooks_persisitent(profileName, notebookName, persisitent)
    return Response( status=200)
    
@api_view(['POST'])
def list_notebooks(request):
    data = json.loads(request.body.decode('utf-8'))
    user = data['user']
    user_obj = User.objects.get(username=data['user'])
    profileName = get_profile_by_email(user_obj.email)
    
    # check the user is exist or not
    try:
        User.objects.get(username=user)
    except:
        return Response(status=400)
    notebooks = list_notebooks_api(profileName)
    return Response(notebooks, status=200)
    
def list_notebooks_api(namespace):
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    try:
        # Create an API client for the CustomResourceDefinition API
        api = client.CustomObjectsApi()

        # Get the profile
        all_notebooks = api.list_namespaced_custom_object(group, version,  namespace, "notebooks")
        # print("all_notebooks = {}", all_notebooks)
        all_notebooks = all_notebooks['items']            
        # print("all_notebooks 1 = {}", all_notebooks)

        Response = []
        for notebook in all_notebooks:
            name = notebook["metadata"]["name"]
            cpu = notebook["spec"]["template"]["spec"]["containers"][0]["resources"]["requests"]["cpu"]
            memory = notebook["spec"]["template"]["spec"]["containers"][0]["resources"]["requests"]["memory"]
            persisitent = ""
            try:
                persisitent = notebook["metadata"]["labels"]["persisitent"]
            except:
                persisitent = "false"
                
            try:
                gpus = notebook["spec"]["template"]["spec"]["containers"][0]["resources"]["limits"]["nvidia.com/gpu"]
            except:
                gpus = "0"

            try:
                status =notebook["status"]["conditions"][0]["status"]
            except:
                status = 'none'

            ResponseOne = { "name": name, "cpu": cpu, "memory": memory, "gpus": gpus, "persisitent": persisitent, "status": status }
            Response.append(ResponseOne)

        print("Response = {}", Response)
        return Response

    except Exception as e:
        print(f"An error occurred: {e}")
        return []
    
def get_profile_by_email(email):
    profiles = get_all_profiles()['items']
    # pprint(profiles)
    for p in profiles:
        if p['spec']['owner']['name'].lower() == email.lower():
            return p['metadata']['name']
    return None
    
def check_email(email):
    profiles = get_all_profiles()['items']
    # pprint(profiles)
    for p in profiles:
        if p['spec']['owner']['name'] == email.lower():
            return True
    return False
    
def delete_profile(name):
    # delete profile
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    api_instance = client.CustomObjectsApi()

    api_response = api_instance.delete_cluster_custom_object(
        group=group,
        version=version,
        plural=plural,
        name=name.lower(),
    )
    print(api_response)

def create_profile(username, email, cpu, gpu, memory, manager):
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    # print("create profile: username = {}, email = {}, cpu = {}, gpu = {}, memory = {}".format(username, email, cpu, gpu, memory))

    # memoryStr = str(int(float(memory)*1000)) + "Mi"
    memoryStr = str(int(float(memory))) + "Gi"
    # print(" memoryStr = {}".format(memoryStr))
    
    profile_data = {
        "apiVersion": "kubeflow.org/v1",
        "kind": "Profile",
        "metadata": {
            "name": username.lower(),
            "annotations": {
                "manager": manager,
                "cpu" : cpu,
                "gpu" : gpu,
                "memory" : memory
            }
        },
        "spec": {
            "owner": {
                "kind": "User",
                "name": email.lower()
            },
            "resourceQuotaSpec": {
                "hard": {
                }
            }
        }
    }

    if cpu != '0':
        cpudecimal = float(cpu)
        cpudecimal = cpudecimal/10
        cpupinteger = float(cpu)
        cpufinal = cpupinteger+cpudecimal
        profile_data["spec"]["resourceQuotaSpec"]["hard"]["requests.cpu"] = str(cpufinal)

    if memoryStr != '0Gi':
        memoryIntStr = memoryStr[:-2]
        memorydecimal = float(memoryIntStr)
        memorydecimal = memorydecimal/10
        memoryinteger = float(memoryIntStr)
        memoryfinal = memorydecimal+memoryinteger
        profile_data["spec"]["resourceQuotaSpec"]["hard"]["requests.memory"] = str(memoryfinal*1000) + 'Mi'
    
    if gpu != '0':
        profile_data["spec"]["resourceQuotaSpec"]["hard"]["requests.nvidia.com/gpu"] = gpu

    api_instance = client.CustomObjectsApi()

    api_response = api_instance.create_cluster_custom_object(
        group=group,
        version=version,
        plural=plural,
        body=profile_data,
    )
    print(api_response)

def get_profile_content(profile_name):
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    try:
        # Create an API client for the CustomResourceDefinition API
        api = client.CustomObjectsApi()

        # Get the profile
        profile = api.get_cluster_custom_object(group, version, plural, profile_name)

        return profile

    except Exception as e:
        print(f"An error occurred: {e}")
        return None
    
def replace_quota_of_profile(profile,cpu,gpu,memory):
    # create resourceQuotaSpec object
    memoryStr = str(int(float(memory))) + "Gi"
    resourceQuotaSpec = {
        "hard": {
        }
    }
    if str(cpu) != '0':
        cpudecimal = float(cpu)
        cpudecimal = cpudecimal/10
        cpupinteger = float(cpu)
        cpufinal = cpupinteger+cpudecimal
        resourceQuotaSpec["hard"]["requests.cpu"] = str(cpufinal)

    if str(memoryStr) != '0Gi':
        memoryIntStr = memoryStr[:-2]
        memorydecimal = float(memoryIntStr)
        memorydecimal = memorydecimal/10
        memoryinteger = float(memoryIntStr)
        memoryfinal = memorydecimal+memoryinteger
        resourceQuotaSpec["hard"]["requests.memory"] = str(memoryfinal*1000) + 'Mi'
        
    if str(gpu) != '0':
        resourceQuotaSpec["hard"]["requests.nvidia.com/gpu"] = str(gpu)

    # update resourceQuotaSpec of profile
    profile['spec']['resourceQuotaSpec'] = resourceQuotaSpec

    api = client.CustomObjectsApi()
    # replace the profile 
    api_response = api.replace_cluster_custom_object(
        group=group,
        version=version,
        plural=plural,
        name=profile['metadata']['name'],
        body=profile
    )
    print(api_response)

def get_all_profiles():
    # get cluster custom object profile of kubeflow.org
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    api_instance = client.CustomObjectsApi()
    return api_instance.list_cluster_custom_object(group, version, plural)

# This is a test function
def replace_all_profiles():
    profiles = get_all_profiles()['items']
    for p in profiles:
        replace_quota_of_profile(p,cpu='8',gpu=1,memory='16')

def replace_profile(name,cpu,gpu,memory):
    profiles = get_all_profiles()['items']
    for p in profiles:
        if p['metadata']['name'] == name:
            replace_quota_of_profile(p,cpu,gpu,memory)

def replace_profile_user(name,user,cpu,gpu,memory):
    profiles = get_all_profiles()['items']
    print("name = ", name)
    for p in profiles:
        if p['metadata']['name'] == name:
            userAnnotations = {
                "manager": user,
                "cpu" : cpu,
                "gpu" : gpu,
                "memory" : memory
            }
            p['metadata']['annotations'] = userAnnotations
            print(" p = ", p)
            api = client.CustomObjectsApi()
            # replace the profile 
            api_response = api.replace_cluster_custom_object(
                group=group,
                version=version,
                plural=plural,
                name=p['metadata']['name'],
                body=p
            )
            print(api_response)


def get_gid():
    while True:
        uid = random.randint(10000, 65535)  # Generate a random UID within the range of user IDs
'''        try:
            pwd.getgrgid(uid)  # Attempt to get the user entry for the generated UID
        except KeyError:
            return uid
'''

def connectLDAP():
    server = Server('ldap://' + urls.LDAP_IP + ':' + urls.LDAP_PORT)
    conn = Connection(server, user='cn=admin,dc=example,dc=org',
                      password='Not@SecurePassw0rd', auto_bind=True)
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
    # remove the root user
    for detail in UserDetail.objects.filter(permission=0):
        user_list.remove(detail.uid.username)
    return Response(user_list, status=200)


@api_view(['POST'])
def get_group_corresponding_user(request):
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
                if(group.name == 'root'):
                    continue
                User.objects.filter(groups=group)
                user_list = []
                for user in User.objects.filter(groups=group):
                    user_list.append(user.username)
                group_list.append({"group_dn": group.name, "member_uids": user_list})
            return Response(group_list, status=200)
        elif detail_obj[0].permission == 1:
            # get only the group that user is in
            for group_item in detail_obj:
                if(group_item.labname.name == 'root'):
                    continue
                User.objects.filter(groups=group_item.labname)
                user_list = []
                for user in User.objects.filter(groups=group_item.labname):
                    user_list.append(user.username)
                group_list.append({"group_dn": group_item.labname.name, "member_uids": user_list})
            return Response(group_list, status=200)
        return Response(group_list, status=200)
    else:
        # get user permission from database
        
        for group_item in detail_obj:

            # if root user, get all group
            print(group_item.permission)
            if group_item.permission == 0:
                for group in Group.objects.all():
                    if(group.name == 'root'):
                        continue
                    User.objects.filter(groups=group)
                    user_list = []
                    for user in User.objects.filter(groups=group):
                        user_list.append(user.username)
                    group_list.append({"group_dn": group.name, "member_uids": user_list})
                return Response(group_list, status=200)
            
            User.objects.filter(groups=group_item.labname)
            user_list = []
            for user in User.objects.filter(groups=group_item.labname):
                user_list.append(user.username)
            group_list.append({"group_dn": group_item.labname.name, "member_uids": user_list}) 
        return Response(group_list, status=200)            
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
        # get group default quota and gpu vendor
    try:
        cpuQuota = GroupDefaultQuota.objects.get(labname=group).cpu_quota
        memQuota = GroupDefaultQuota.objects.get(labname=group).mem_quota
        gpuQuota = GroupDefaultQuota.objects.get(labname=group).gpu_quota
        gpuVendor = GroupDefaultQuota.objects.get(labname=group).gpu_vendor
    except:
        cpuQuota = 0
        memQuota = 0
        gpuQuota = 0
        gpuVendor = "NVIDIA"
    
    # get the user permission from database
    data = {
        "labname": labname,
        "gidNumber": group.id,
        "cpuQuota": cpuQuota,
        "memQuota": memQuota,
        "gpuQuota": gpuQuota,
        "gpuVendor": gpuVendor,
        "memberUid": get_all_user_permission(user_list, labname)
    }
    return Response(data, status=200)

@api_view(['POST'])
def addlab(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    cpuQuota = data['cpu_quota']
    memQuota = data['mem_quota']
    gpuQuota = data['gpu_quota']
    gpuVendor = data['gpu_vendor']    
    
    # check Group is exist or not
    try:
        Group.objects.get(name=labname)
        return Response(status=500, data="lab is exist")
    except:
        pass

    
    # check the cpuQuota, memQuota, gpuQuota is valid or not
    try:
        cpuQuota = int(cpuQuota)
        memQuota = int(memQuota)
        gpuQuota = int(gpuQuota)
    except: 
        return Response(status=500, data="cpuQuota, memQuota, gpuQuota is not valid")
    
    # gpu type error handle
    if gpuVendor != "NVIDIA" and gpuVendor != "AMD":
        return Response(status=500, data="gpuVendor is not valid")
    
    group = Group.objects.create(name=labname)
    GroupDefaultQuota.objects.create(labname=group, cpu_quota=cpuQuota, mem_quota=memQuota, gpu_quota=gpuQuota, gpu_vendor=gpuVendor)
    return Response(status=200, data={"message": "add lab {} success".format(labname)})

@api_view(['POST'])
def editlab(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    cpuQuota = data['cpu_quota']
    memQuota = data['mem_quota']
    gpuQuota = data['gpu_quota']
    gpuVendor = data['gpu_vendor']
    try:
        cpuQuota = int(cpuQuota)
        memQuota = int(memQuota)
        gpuQuota = int(gpuQuota)
    except:
        return Response(status=500, data="cpuQuota, memQuota, gpuQuota is not valid")
    if gpuVendor != "NVIDIA" and gpuVendor != "AMD":
        return Response(status=500, data="gpuVendor is not valid")
    group = Group.objects.get(name=labname)
    if group is None:
        return Response(status=500, data="lab is not exist")
    
    # if GroupDefaultQuota is exist, update the default quota, else create the default quota
    if GroupDefaultQuota.objects.filter(labname=group).exists():
        groupDefaultQuota = GroupDefaultQuota.objects.get(labname=group)
        groupDefaultQuota.cpu_quota = cpuQuota
        groupDefaultQuota.mem_quota = memQuota
        groupDefaultQuota.gpu_quota = gpuQuota
        groupDefaultQuota.gpu_vendor = gpuVendor
        groupDefaultQuota.save()
    else:
        GroupDefaultQuota.objects.create(labname=group, cpu_quota=cpuQuota, mem_quota=memQuota, gpu_quota=gpuQuota, gpu_vendor=gpuVendor)
    return Response(status=200, data={"message": "edit lab {} success".format(labname)})

@api_view(['POST'])
def get_default_values(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['labname']
    try:
        groupDefaultQuota = GroupDefaultQuota.objects.get(labname=Group.objects.get(name=labname))
        cpuQuota = groupDefaultQuota.cpu_quota
        memQuota = groupDefaultQuota.mem_quota
        gpuQuota = groupDefaultQuota.gpu_quota
        gpuVendor = groupDefaultQuota.gpu_vendor
    except:
        cpuQuota = 0
        memQuota = 0
        gpuQuota = 0
        gpuVendor = "NVIDIA"
    return Response({"cpu_quota": cpuQuota, "mem_quota": memQuota, "gpu_quota": gpuQuota, "gpu_vendor": gpuVendor}, status=200)

@api_view(['POST'])
def adduser(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username'].lower()
    firstname = data['first_name']
    lastname = data['last_name']
    password = data['password']
    labname = data['lab']
    email = data['email'].lower()
    cpu_quota = data['cpu_quota']
    mem_quota = data['mem_quota']
    gpu_quota = data['gpu_quota']
    gpu_vendor = data['gpu_vendor']

    if check_email(email):
        return Response(status=500, data={"message": "Email is exist from kubeflow profile"})
    try:
        # if user is exist, return 500
        user_exist = User.objects.get(username=username)
        return Response(status=500, data={"message": "Username is exist from database and the email is {}, username is {}".format(user_exist.email, user_exist.username)})
    except:
        pass
    # email is exist or not
    try:
        user_exist = User.objects.get(email=email)
        return Response(status=500, data={"message": "Email is exist from database and the username is {}, email is {}".format(user_exist.username, user_exist.email)})
    except:
        pass
    # check ldap is exist or not
    conn = connectLDAP()
    try:
        conn.search('cn={},ou=users,dc=example,dc=org'.format(username), '(objectclass=posixAccount)', attributes=['*'])
        for entry in conn.entries:
            return Response(status=500, data={"message": "Username is exist from ldap and the email is {}, username is {}".format(entry.mail.value, entry.cn.value)})
    except:
        pass
        
    user = User.objects.create_user(username=username, password=password, first_name=firstname, last_name=lastname, email=data['email'])
    user.groups.add(Group.objects.get(name=labname))
    password = user.password
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    user_dn = 'cn={},ou=users,dc=example,dc=org'.format(username),
    conn = connectLDAP()
    conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
        {'cn': username, 'givenName': username, 'sn' : username ,
        'uid': username, 'uidNumber': '2001', 'gidNumber': '1001', "mail": email,
        'homeDirectory': '/home/{}'.format(username), 'loginShell': '/bin/bash',
        'userPassword': password.split('$')[1], 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
        'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
        'shadowExpire': '99999', 'Description': [labname]})
    group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(labname)
    conn.modify(group_dn, {'memberUid': [(MODIFY_ADD, [username])]})
    conn.unbind()
    manager = 'user'
    if data['is_lab_manager'] is False:
        UserDetail.objects.create(uid=user, permission=2, labname=Group.objects.get(name=labname))
    elif data['is_lab_manager'] is True:
        manager = 'manager'
        UserDetail.objects.create(uid=user, permission=1, labname=Group.objects.get(name=labname))
    user.save()
    # add gpu vendor
    UserGPUQuotaType.objects.create(user=user, gpuType=gpu_vendor)
    create_profile(username=username, email=email,cpu=cpu_quota, gpu=gpu_quota, memory=mem_quota, manager=manager)
    
    send_email_gmail('Introduction', 'Account Created', email)

    return Response(status=200)

@api_view(['POST'])
def add_admin(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    user = User.objects.get(username=username)
    user.is_superuser = True
    user.is_staff = True
    for group in user.groups.all():
        user.groups.remove(group)
    user.groups.add(Group.objects.get(name='root'))
    user.save()
    detail = UserDetail.objects.filter(uid=user.id)
    for item in detail:
        item.delete()
    UserDetail.objects.create(uid=user, permission=0, labname=Group.objects.get(name='root'))
    # remove the user from all group in ldap 
    conn = connectLDAP()
    conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
    for entry in conn.entries:
        try:
            conn.modify(entry.entry_dn, {'memberUid': [(MODIFY_DELETE, [username])]})
        except:
            pass
    # add user into root group
    conn.modify('cn=root,ou=Groups,dc=example,dc=org', {'memberUid': [(MODIFY_ADD, [username])]})
    # add description into user 'root'
    conn.search('cn={},ou=users,dc=example,dc=org'.format(username), '(objectclass=posixAccount)', attributes=['*'])
    for entry in conn.entries:
        conn.modify(entry.entry_dn, {'Description': [(MODIFY_ADD, ['root'])]})
    conn.unbind()

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
    profileName = get_profile_by_email(user_obj.email)
    profile = get_profile_content(profileName)
    memory = ""
    cpu = ""
    gpu = ""
    if profile is not None:
        print(profile)
        # add try error control below
        try:
            cpu = profile["metadata"]["annotations"]["cpu"]
        except:
            try:
                cpu = profile['spec']['resourceQuotaSpec']['hard']['requests.cpu']
            except:
                cpu = "0"

        try:
            gpu = profile["metadata"]["annotations"]["gpu"]
        except:
            try:
                gpu = profile['spec']['resourceQuotaSpec']['hard']['requests.nvidia.com/gpu']
            except:
                gpu = "0"

        try:
            memory = profile["metadata"]["annotations"]["memory"]
        except:
            try:
                memory = profile['spec']['resourceQuotaSpec']['hard']['requests.memory']
                memory = memory[:-2]
            except:
                memory = "0"
                
    else:
        print("Profile not found")
        memory = "0"
        cpu = "0"
        gpu = "0"
        
    # memoryStr = str(float(memory)/1000)    
    memoryStr = memory
    print("cpu = {}, gpu = {}, memory = {}, memoryStr = {} ".format(cpu, gpu, memory, memoryStr))
    notebooks = list_notebooks_api(profileName)
    # print("notebooks 2 = {}", notebooks)
    data = {
        "username": user_obj.username,
        "first_name": user_obj.first_name,
        "last_name": user_obj.last_name,
        "email": user_obj.email,
        "cpu_quota" : cpu,
        "mem_quota" : memoryStr,
        "gpu_quota" : gpu,
        "permission": get_user_all_permission(user_obj.username),
        "notebooks": notebooks,
    }
    return Response(data, status=200)

def deleteUserModel(username):
    user_obj = User.objects.get(username=username)
    profileName = get_profile_by_email(user_obj.email)
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
    delete_profile(profileName)

@api_view(['POST'])
def user_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    deleteUserModel(data['username'])
    return Response(status=200)

@api_view(['POST'])
def lab_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    # delete the group from database
    Group.objects.get(name=labname).delete()
    conn = connectLDAP()
    # delete the group from ldap
    conn.delete('cn={},ou=Groups,dc=example,dc=org'.format(labname))
    conn.unbind()
    return Response(status=200)

    
def user_group_num(requset):
    group_list = []
    user_list = []
    for user_obj in User.objects.all():
        user_list.append(user_obj.username)
    for group_obj in Group.objects.all():
        group_list.append(group_obj.name)
    # user_num in database
    user_num = len(User.objects.all())
    group_num = len(Group.objects.all())
    # return the number of group and user
    data = {'lab_num': group_num, 'lab_list': group_list, 'user_num': user_num, 'user_list': user_list}
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
    if isinstance(password, int) is True:
        return Response({'message': 'password is cannot be all number'}, status=400)
    user.set_password(password)
    user.save()
    # change password in ldap
    conn = connectLDAP()
    conn.search('cn={},ou=users,dc=example,dc=org'.format(username), '(objectclass=posixAccount)', attributes=['*'])
    for entry in conn.entries:
        conn.modify(entry.entry_dn, {'userPassword': [(MODIFY_REPLACE, [user.password.split('$')[1]])]})
    conn.unbind()

    return Response(status=200)

@api_view(['POST'])
def change_user_info(request):
    data = json.loads(request.body.decode('utf-8'))
    username = data['username']
    firstname = data['firstname']
    lastname = data['lastname']
    email = data['email']
    permission = data['permission']
    cpu_quota = data['cpu_quota']
    mem_quota = data['mem_quota']
    gpu_quota = data['gpu_quota']

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

        user_obj = User.objects.get(username=data['username'])
        detail_obj = UserDetail.objects.filter(uid=user_obj.id)
        profileName = get_profile_by_email(user_obj.email)

        replace_profile(profileName,cpu_quota,gpu_quota,mem_quota)
        # manager = 'user'
        # if data['is_lab_manager'] is True:
        #    manager = 'manager'
        # print("manager = ", manager)    
        # replace_profile_user(profileName, manager)

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
                print("permission_obj = ", permission_obj['permission'])
                detail_obj.save()
            manager = 'user'
            if permission_obj['permission'] == 'admin':
                manager = 'manager'
            elif permission_obj['permission'] == 'user':
                manager = 'user'
            print("manager = ", manager)    
            replace_profile_user(profileName, manager,cpu_quota,gpu_quota,mem_quota)
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
            if row[0].value == "Username":
                continue
            if row[0] is None:
                continue
            row[0].value = row[0].value.lower()
            row[3].value = row[3].value.lower()
            if Group.objects.filter(name=row[1].value).exists() is False:
                group = Group.objects.create(name=row[1].value)
                print("add lab {} success".format(row[1].value))
            if User.objects.filter(username=row[0].value).exists() is True:
                # check the user is in the group or not
                subuser_obj = User.objects.get(username=row[0].value)
                if subuser_obj.email != row[3].value:
                    subuser_obj.email = row[3].value
                if subuser_obj.first_name != row[4].value:
                    subuser_obj.first_name = row[4].value
                if subuser_obj.last_name != row[5].value:
                    subuser_obj.last_name = row[5].value
                subuser_obj.save()

                for group_obj in User.objects.get(username=row[0].value).groups.all():
                    if group_obj.name == row[1].value:
                        # check password is correct or not
                        if User.objects.get(username=row[0].value).check_password(row[2].value) is False:
                            if User.objects.get(username=row[0].value).password == row[2].value:
                                print("user {} password is correct".format(row[0].value))
                            else:
                                user_obj_password = User.objects.get(username=row[0].value)
                                print(user_obj_password.set_password(row[2].value))
                                user_obj_password.save()
                                print("user {} password is not correct, change password to {}".format(row[0].value, row[2].value))
                        if get_permission(row[0].value, row[1].value) == row[6].value:
                            print("user {} permission is correct".format(row[0].value))
                        else:
                            UserDetail.objects.get(uid=User.objects.get(username=row[0].value).id, labname=Group.objects.get(name=row[1].value)).delete()
                            if row[6].value == 'admin':
                                UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=1, labname=Group.objects.get(name=row[1].value))
                            elif row[6].value == 'user':
                                UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=2, labname=Group.objects.get(name=row[1].value))
                            print("user {} permission is not correct, change permission to {}".format(row[0].value, row[6].value))
                        break
                    else:
                        try:
                            User.objects.get(username=row[0].value).groups.add(Group.objects.get(name=row[1].value))
                            print("add user {} into group {} success".format(row[0].value, row[1].value))
                            if row[6].value == 'admin':
                                UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=1, labname=Group.objects.get(name=row[1].value))
                            elif row[6].value == 'user':
                                UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=2, labname=Group.objects.get(name=row[1].value))
                            elif row[6].value == 'root':
                                UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=0, labname=Group.objects.get(name=row[1].value))
                        except:
                            pass
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
    user_list.append(["Username","Group","password","email", "firstname", "lastname", "permission", "cpu_quota", "gpu_quota", "mem_quota"])
    # export the user in the group from database
    for user in User.objects.all():
        cpuquota = 0
        gpuquota = 0
        memquota = 0
        user_obj = User.objects.get(username=user.username)
        profileName = get_profile_by_email(user_obj.email)
        profile = get_profile_content(profileName)
        if profile is not None:
            print(profile)
            # add try error control below
            try:
                cpu = profile['spec']['resourceQuotaSpec']['hard']['requests.cpu']
            except:
                cpu = "0"
            try:
                gpu = profile['spec']['resourceQuotaSpec']['hard']['requests.nvidia.com/gpu']
            except:
                gpu = "0"
            try:
                memory = profile['spec']['resourceQuotaSpec']['hard']['requests.memory']
                memory = memory[:-2]
            except:
                memory = "0"
        else:
            print("Profile not found")
            memory = "0"
            cpu = "0"
            gpu = "0"
        for group in user.groups.all():
            
            user_list.append([user.username, group.name, user.password, user.email, user.first_name, user.last_name, get_permission(user.username, group.name), cpu, gpu, memory])
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
    print(user_all_obj)
    for user in user_all_obj:
        if user.groups.filter(name=lab).exists() is False:
            outside_user.append(user.username)
    # if user is permission 0 remove it
    for user in UserDetail.objects.filter(permission=0):
        outside_user.remove(user.uid.username)
    print(outside_user)
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
    user_list.append(["Username", "password", "email", "firstname", "lastname", "permission", "cpu_quota", "gpu_quota", "mem_quota"])
    # export the user in the group from database
    for user in User.objects.filter(groups=Group.objects.get(name=lab)):
        cpuquota = 0
        gpuquota = 0
        memquota = 0
        profileName = get_profile_by_email(user.email)
        profile = get_profile_content(profileName)
        if profile is not None:
            print(profile)
            # add try error control below
            try:
                cpu = profile['spec']['resourceQuotaSpec']['hard']['requests.cpu']
            except:
                cpu = "0"
            try:
                gpu = profile['spec']['resourceQuotaSpec']['hard']['requests.nvidia.com/gpu']
            except:
                gpu = "0"
            try:
                memory = profile['spec']['resourceQuotaSpec']['hard']['requests.memory']
                memory = memory[:-2]
            except:
                memory = "0"
        else:
            print("Profile not found")
            memory = "0"
            cpu = "0"
            gpu = "0"
        user_list.append([user.username, user.password ,user.email, user.first_name, user.last_name, get_permission(user.username, lab), cpu, gpu, memory])
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
        with open('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name, 'wb+') as destination:
            for chunk in excel_file.chunks():
                destination.write(chunk)
        # read and pritn the excel file, attribute ["Username","password","email", "firstname", "lastname", "permission"]
        worksheet = openpyxl.load_workbook('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name).active
        # Get all information from the excel file
        userinfo = []
        for row in worksheet.iter_rows():
            # error control: if the row is empty or the first row
            if row[0].value == "Username" or row[0].value is None:
                continue
                
            Excelemail = row[2].value.lower() if row[2].value is not None else None 
            user = {
                "username": row[0].value.lower(),
                "password": row[1].value,
                "email": Excelemail,
                "firstname": row[3].value,
                "lastname": row[4].value,
                "permission": row[5].value,
                "cpu_quota": row[6].value,
                "gpu_quota": row[7].value,
                "mem_quota": row[8].value,
            }
            userinfo.append(user)
        # check all data is valid or not with database, use pandas
        for user in userinfo:
            if user['permission'] != 'admin' and user['permission'] != 'user':
                return JsonResponse({'message': 'user {} permission is not valid'.format(user['username'])}, status=400)
            # password is or not valid(all integer)
            if isinstance(user['password'], int) is True:
                return JsonResponse({'message': 'user {} password is not valid'.format(user['username'])}, status=400)
        # check all data is exist in database, ldap, and kubeflow or not
        failed_user = []
        for user in userinfo:
            # if username is exist in database
            if User.objects.filter(username=user['username']).exists() is True:
                failed_user.append({user['username']: "username is exist in database"})
                continue
            if User.objects.filter(email=user['email']).exists() is True:
                # "username":"reason"
                failed_user.append({user['username']: "email is exist in database"})
                continue
            # if user is exist in ldap
            try:
                conn = connectLDAP()
                conn.search('cn={},ou=users,dc=example,dc=org'.format(user['username']), '(objectclass=posixAccount)', attributes=['*'])
                for entry in conn.entries:
                    failed_user.append({user['username']: "username is exist in ldap"})
                    continue
            except:
                pass
            # if user is exist in kubeflow
            if get_profile_by_email(user['email']) is not None:
                failed_user.append({user['username']: "email is exist in kubeflow"})
                continue
        # add user into django, ldap, and kubeflow
        for user in userinfo:
            try:
                User.objects.create_user(username=user['username'], password=user['password'], first_name=user['firstname'], last_name=user['lastname'], email=user['email'])
                user_obj = User.objects.get(username=user['username'])
                user_obj.groups.add(Group.objects.get(name=group))
                if user['permission'] == 'admin':
                    UserDetail.objects.create(uid=user_obj, permission=1, labname=Group.objects.get(name=group))
                elif user['permission'] == 'user':
                    UserDetail.objects.create(uid=user_obj, permission=2, labname=Group.objects.get(name=group))
            except:
                failed_user.append({user['username']: "user add into database failed"})
                continue
            
            try:
                # add user into kubeflow's profile
                create_profile(username=user['username'], email=user['email'],cpu=user['cpu_quota'], gpu=user['gpu_quota'], memory=user['mem_quota'], manager=user['permission'])
            except:
                # if user is not added into kubeflow, remove the user from database
                failed_user.append({user['username']: "user add into kubeflow failed"})
                continue
                # add user into ldap
            try:
                group_dn = 'cn={},ou=Groups,dc=example,dc=org'.format(group)
                user_dn = 'cn={},ou=users,dc=example,dc=org'.format(user['username']),
                conn = connectLDAP()
                conn.add(user_dn, ['inetOrgPerson', 'posixAccount', 'shadowAccount', 'top'],
                    {'cn': user['username'], 'givenName': user['firstname'], 'sn' : user['lastname'] ,
                    'uid': user['username'], 'uidNumber': '2001', 'gidNumber': '1001', "mail": user['email'],
                    'homeDirectory': '/home/{}'.format(user['username']), 'loginShell': '/bin/bash',
                    'userPassword': user['password'], 'shadowFlag': '0', 'shadowMin': '0', 'shadowMax': '99999', 
                    'shadowWarning': '0', 'shadowInactive': '99999', 'shadowLastChange': '12011', 
                    'shadowExpire': '99999', 'Description': [group]})
                conn.modify(group_dn, {'memberUid': [(MODIFY_ADD, [user['username']])]})
                conn.unbind()
            except:
                failed_user.append({user['username']: "user add into ldap failed"})
                continue
        print(failed_user)
        if len(failed_user) == 0:
            return JsonResponse({'message': 'all user is added'}, status=200)
        elif len(failed_user) == len(userinfo):
            return JsonResponse({'message': 'except user {}, the other users were added'.format(failed_user)}, status=400)
        else:
            return JsonResponse({'message': '{} users are not added'.format(failed_user)}, status=400)
    else:
        return JsonResponse({'message': 'file is not exist'}, status=400)
        
# @api_view(['POST'])
# def import_lab_user(request):
#     group = request.POST['lab']
#     print(group)
#     if request.FILES.get('file'):
#         excel_file = request.FILES['file']
#         conn = connectLDAP()
#         with open('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name, 'wb+') as destination:
#             for chunk in excel_file.chunks():
#                 destination.write(chunk)
#         # read and pritn the excel file, attribute ["Username","password","email", "firstname", "lastname", "permission"]
#         worksheet = openpyxl.load_workbook('./' +  datetime.datetime.now().strftime('%Y%m%d%H%M%S') + excel_file.name).active
#         # intialize check all false
#         # check all data is valid or not with database, use pandas
#         for row in worksheet.iter_rows():
#             if row[0].value == "Username":
#                 continue
#             ## if there is any data is null, return error
#             for item in row:
#                 if item.value == None:
#                     return JsonResponse({'message': 'excel format is not valid'}, status=400)
#             if row[5].value != 'admin' and row[5].value != 'user':
#                 return JsonResponse({'message': 'user {} permission is not valid'.format(row[0].value)}, status=400)
#             # password is or not valid(all integer)
#             if isinstance(row[1].value, int) is True:
#                 return JsonResponse({'message': 'user {} password is not valid'.format(row[0].value)}, status=400)
        
#         # check all data is exist in database, ldap, and kubeflow or not
#         failed_user = []
#         for row in worksheet.iter_rows():
#             # if username is exist in database
#             username_excel = row[0].value
#             if User.objects.filter(username=username_excel).exists() is True:
#                 failed_user.append(row[0].value)
#                 # remove the user from excel
#                 worksheet.remove(row)
#                 continue
#             email_excel = row[1].value
#             if User.objects.filter(email=email_excel).exists() is True:
#                 failed_user.append(row[0].value)
#                 worksheet.remove(row)
#                 continue
#             # if user is exist in ldap
#             try:
#                 conn.search('cn={},ou=users,dc=example,dc=org'.format(username_excel), '(objectclass=posixAccount)', attributes=['*'])
#                 for entry in conn.entries:
#                     failed_user.append(row[0].value)
#                     worksheet.remove(row)
#                     continue
#             except:
#                 pass
#             # if user is exist in kubeflow
#             if get_profile_by_email(email_excel) is not None:
#                 failed_user.append(row[0].value)
#                 worksheet.remove(row)
#                 continue
#         # add user into django
#         for row in worksheet.iter_rows():
#             if row[0].value == "Username":
#                     continue
#             # if user is exist and in correct group, skip
#             user_corresponding_group = False
#             if User.objects.filter(username=row[0].value).exists() is True:
#                 subuser_obj = User.objects.get(username=row[0].value)
#                 if subuser_obj.email != row[2].value:
#                     subuser_obj.email = row[2].value
#                 if subuser_obj.first_name != row[3].value:
#                     subuser_obj.first_name = row[3].value
#                 if subuser_obj.last_name != row[4].value:
#                     subuser_obj.last_name = row[4].value
#                 subuser_obj.save()

#                 for group_obj in User.objects.get(username=row[0].value).groups.all():
#                     if group_obj.name == group:
#                         user_corresponding_group = True
#                         # check password is correct or not
#                         print(User.objects.get(username=row[0].value).check_password(row[1].value), row[1].value)
#                         if User.objects.get(username=row[0].value).check_password(row[1].value) is False:
#                             if User.objects.get(username=row[0].value).password == row[1].value:
#                                 print("user {} password is correct".format(row[0].value))
#                                 continue
#                             user_obj_password = User.objects.get(username=row[0].value)
#                             print(user_obj_password.set_password(row[1].value))
#                             user_obj_password.save()
#                             print("user {} password is not correct, change password to {}".format(row[0].value, row[1].value))

#                         if get_permission(row[0].value, group) == row[5].value:
#                             print("user {} permission is correct".format(row[0].value))
#                         else:
#                             UserDetail.objects.get(uid=User.objects.get(username=row[0].value).id, labname=Group.objects.get(name=group)).delete()
#                             if row[5].value == 'admin':
#                                 UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=1, labname=Group.objects.get(name=group))
#                             elif row[5].value == 'user':
#                                 UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=2, labname=Group.objects.get(name=group))
#                             print("user {} permission is not correct, change permission to {}".format(row[0].value, row[5].value))
#                         break
#                 if user_corresponding_group is True:
#                     continue
#                 else:
#                     # add user into corresponding group
#                     User.objects.get(username=row[0].value).groups.add(Group.objects.get(name=group))
#                     if row[5].value == 'admin':
#                         UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=1, labname=Group.objects.get(name=group))
#                     else:
#                         UserDetail.objects.create(uid=User.objects.get(username=row[0].value), permission=2, labname=Group.objects.get(name=group))
                    
            
#             # add new user into django
#             user = User.objects.create_user(username=row[0].value, password=row[1].value, first_name=row[3].value, last_name=row[4].value, email=row[2].value)
#             user.groups.add(Group.objects.get(name=group))
#             if row[5].value == 'admin':
#                 UserDetail.objects.create(uid=user, permission=1, labname=Group.objects.get(name=group))
#             else:
#                 UserDetail.objects.create(uid=user, permission=2, labname=Group.objects.get(name=group))
#     if failed_user != []:
#         return JsonResponse({'message': 'user {} is exist in database, ldap, or kubeflow'.format(failed_user)}, status=400)
#     return JsonResponse({'message': 'File upload success'}, status=200)

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
    for user in users:
        deleteUserModel(User.objects.get(username=user).username)
        # delete_profile(get_profile_by_email(User.objects.get(username=user).email))
        # conn.delete('cn={},ou=users,dc=example,dc=org'.format(user))
        # # remove from group entry
        # conn.search('dc=example,dc=org', '(objectclass=posixGroup)', attributes=['cn'])
        # for entry in conn.entries:
        #     try:
        #         conn.modify(entry.entry_dn, {'memberUid': [(MODIFY_DELETE, [user])]})
        #     except:
        #         pass
        # User.objects.get(username=user).delete()
        # remove user from kube flow
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

@api_view(['GET'])
def template(request):
    # export excel template for import
    column = []
    column.append(["Username", "password", "email", "firstname", "lastname", "permission", "cpu_quota", "gpu_quota", "mem_quota"])
    
    # make data to excel
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    for row in column:
        worksheet.append(row)
    workbook.save("import_template.xlsx")
    excel_file_path = 'import_template.xlsx'
    # return the file
    response = HttpResponse(content_type="application/ms-excel")
    response['Content-Disposition'] = 'attachment; filename=import_template.xlsx'
    workbook.save(response)
    return response

# Get yaml's of notebooks for moving notebooks [Patten, 2025/01/06]
@api_view(["POST"])
def get_notebook_yaml(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
        api = client.CustomObjectsApi()
        # get notebook.yaml
        notebook_yaml = api.get_namespaced_custom_object(group="kubeflow.org", version="v1", namespace=data["namespace"], plural="notebooks", name=data["notebook_name"])
        del notebook_yaml["metadata"]["creationTimestamp"]
        del notebook_yaml["metadata"]["generation"]
        del notebook_yaml["metadata"]["resourceVersion"]
        del notebook_yaml["metadata"]["uid"]
        del notebook_yaml["status"]

        # get pvc.yaml (may be more than 1)
        pvc_names = []
        for volume in notebook_yaml["spec"]["template"]["spec"]["volumes"][1:]:
            pvc_names.append(volume["persistentVolumeClaim"]["claimName"])
        v1 = client.CoreV1Api()
        pvc_yamls = []
        for name in pvc_names:
            pvc_yaml = v1.read_namespaced_persistent_volume_claim(name, data["namespace"])
            pvc_yaml = pvc_yaml.to_dict()
            del pvc_yaml["metadata"]["annotations"]
            del pvc_yaml["metadata"]["creation_timestamp"]
            del pvc_yaml["metadata"]["finalizers"]
            del pvc_yaml["metadata"]["resource_version"]
            del pvc_yaml["metadata"]["uid"]
            del pvc_yaml["status"]
            pvc_yamls.append(pvc_yaml)

        # get pv.yaml
        pv_names = []
        for y in pvc_yamls:
            pv_names.append(y["spec"]["volume_name"])
        pv_yamls = []
        for name in pv_names:
            pv_yaml = v1.read_persistent_volume(name)
            pv_yaml = pv_yaml.to_dict()
            del pv_yaml["metadata"]["annotations"]
            del pv_yaml["metadata"]["creation_timestamp"]
            del pv_yaml["metadata"]["finalizers"]
            del pv_yaml["metadata"]["resource_version"]
            del pv_yaml["metadata"]["uid"]
            del pv_yaml["spec"]["claim_ref"]["resource_version"]
            del pv_yaml["spec"]["claim_ref"]["uid"]
            del pv_yaml["status"]
            pv_yamls.append(pv_yaml)
        response = {"notebook": notebook_yaml, "pvc": pvc_yamls, "pv": pv_yamls}
        return JsonResponse(response, status=200)
    except client.exceptions.ApiException as e:
        return JsonResponse({"error": str(e)}, status=e.status)
    
@api_view(["POST"])
def upload_notebook_yaml(request):
    if request.method == "POST" and request.FILES.get("file"):
        api_v1 = client.CoreV1Api()
        api = client.CustomObjectsApi()
        uploaded_file = request.FILES["file"]
        with zipfile.ZipFile(uploaded_file, "r") as zip:
            file_list = zip.namelist()

            processed_files = []
            for file_name in file_list:
                with zip.open(file_name) as f:
                    file = yaml.load(f, Loader=yaml.SafeLoader)
                    processed_files.append({
                        "file_name": file_name,
                        "content": file
                    })
        pvcs = []
        results = dict()
        for file in processed_files:
            content = file["content"]
            if content["kind"] == "PersistentVolume":
                try:
                    existed = api_v1.read_persistent_volume(content["metadata"]["name"])
                    results[content["metadata"]["name"]] = "existed"
                except Exception as e:
                    obj = client.V1PersistentVolume(**content)
                    api_v1.create_persistent_volume(obj)
                    results[content["metadata"]["name"]] = "non-existed, created it"
            elif content["kind"] == "Notebook":
                try:
                    existed = api.get_namespaced_custom_object(
                        group="kubeflow.org",
                        version="v1",
                        plural="notebooks",
                        namespace=content["metadata"]["namespace"],
                        name=content["metadata"]["name"])
                    results[content["metadata"]["name"]] = "existed"
                except Exception as e:
                    api.create_namespaced_custom_object(group="kubeflow.org",
                                                        version="v1",
                                                        plural="notebooks",
                                                        namespace=content["metadata"]["namespace"],
                                                        body=content)
                    results[content["metadata"]["name"]] = "non-existed, created it"
            elif content["kind"] == "PersistentVolumeClaim":
                pvcs.append(file)
        for file in pvcs:
            content = file["content"]
            try:
                existed = api_v1.read_namespaced_persistent_volume_claim(content["metadata"]["name"], content["metadata"]["namespace"])
                results[content["metadata"]["name"]] = "existed"
            except Exception as e:
                obj = client.V1PersistentVolumeClaim(**content)
                api_v1.create_namespaced_persistent_volume_claim(content["metadata"]["namespace"], obj)
                results[content["metadata"]["name"]] = "non-existed, created it"
        
        return JsonResponse({"files": processed_files, "results": results}, status=200)
