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
import humps

# traceback
import traceback    

def send_email_gmail(subject, message, destination):
    # First assemble the message
    msg = MIMEText(message, 'html')
    msg['Subject'] = subject

    # Login and send the message
    port = 465
    my_mail = 'support01@twentyfouri.com'
    my_password = 'czyq oonp vyxd inor'
    context = ssl.create_default_context() 
    with smtplib.SMTP_SSL('smtp.gmail.com', port, context=context) as server:
        server.login(my_mail, my_password)
        server.sendmail(my_mail, destination, msg.as_string())

def send_add_account_email(k8s_name, k8s_account, k8s_password, destination):
    add_account_email_title = '帳號啟用通知信 ( Account Activation Notification )'
    add_account_email_body = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
            '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
            '<p><span style="font-weight: 400;">感謝您註冊並使用本中心提供之雲端服務，以下為您的帳號資訊：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>使用者名稱</strong><span style="font-weight: 400;">：' + k8s_account + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>初始密碼</strong><span style="font-weight: 400;">：' + k8s_password + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">為保障您的帳號安全，建議您於首次登入後</span><strong>立即變更密碼</strong><span style="font-weight: 400;">。</span></p>'\
            '<p><span style="font-weight: 400;">此外，我們已為您準備完整的使用手冊，協助您快速上手系統操作。請點選以下連結下載：</span></p>'\
            '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://zh.wikipedia.org/zh-tw/%25E8%25B6%2585%25E6%2596%2587%25E6%259C%25AC%25E4%25BC%25A0%25E8%25BE%2593%25E5%258D%258F%25E8%25AE%25AE&amp;source=gmail&amp;ust=1746025313613000&amp;usg=AOvVaw3wGP8hFGfkeIbNPzuv8l5p">點擊這裡下載使用手冊</a></span></p>'\
            '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或非本人授權操作，請立即與我們聯繫，我們將盡速為您處理：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">使用順利、萬事如意</span></p>'\
            '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
            '<p>&nbsp;</p>'\
            '<p>--------------------------------------------------------------------------------</p>'\
            '<p>&nbsp;</p>'\
            '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
            '<p><span style="font-weight: 400;">Thank you for registering and using the cloud services provided by our center. Below are your account details:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Username</strong><span style="font-weight: 400;">: ' + k8s_account + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Initial Password</strong><span style="font-weight: 400;">: ' + k8s_password + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">To ensure the security of your account, we strongly recommend changing your password immediately upon your first login.</span></p>'\
            '<p><span style="font-weight: 400;">We have also prepared a comprehensive user manual to help you get started with the system. You can download it via the following link:</span></p>'\
            '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI&amp;source=gmail&amp;ust=1746082963524000&amp;usg=AOvVaw06m_RAtCuMh0naKiU9sUYV"> download it via click the link</a></span></p>'\
            '<p><span style="font-weight: 400;">If you have any questions or did not authorize this action, please contact us immediately. We will assist you as soon as possible:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">Wishing you a smooth and successful experience.</span></p>'\
            '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'
    send_email_gmail(add_account_email_title, add_account_email_body, destination)

def send_add_group_email(k8s_name, k8s_group, k8s_date, destination):    
    add_group_email_title = '群組加入通知信 ( Group Membership Notification )'
    add_group_email_body = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
            '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
            '<p><span style="font-weight: 400;">您已被加入至本平台中的指定群組，相關資訊如下：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>群組名稱</strong><span style="font-weight: 400;">：' + k8s_group + '&nbsp;</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>加入時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">如您尚未熟悉本平台的群組功能，歡迎參閱我們的使用手冊：</span></p>'\
            '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI&amp;source=gmail&amp;ust=1746082963524000&amp;usg=AOvVaw06m_RAtCuMh0naKiU9sUYV">點擊這裡下載使用手冊</a></span></p>'\
            '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或非本人授權操作，請立即與我們聯繫，我們將盡速為您處理：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">工作順利、使用愉快</span></p>'\
            '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
            '<p>&nbsp;</p>'\
            '<p>--------------------------------------------------------------------------------</p>'\
            '<p>&nbsp;</p>'\
            '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
            '<p><span style="font-weight: 400;">You have been added to a designated group on our platform. The details are as follows:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Group Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Date Joined</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">If you are not yet familiar with the platform&rsquo;s group features, we encourage you to review our user manual:</span><span style="font-weight: 400;"><br /></span><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI"><span style="font-weight: 400;">https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI</span></a></p>'\
            '<p><span style="font-weight: 400;">If you have any questions or did not authorize this action, please contact us immediately. We will assist you promptly:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">Wishing you success and an enjoyable experience.</span></p>'\
            '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'
    send_email_gmail(add_group_email_title, add_group_email_body, destination)

def send_delete_group_email(k8s_name, k8s_group, k8s_date, destination): 
    remove_group_email_title = '群組移除通知信 ( Group Removal Notification )'
    remove_group_email_body = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
            '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
            '<p><span style="font-weight: 400;">您已自本平台中的下列群組中移除，相關資訊如下：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>群組名稱</strong><span style="font-weight: 400;">：' + k8s_group + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>移除時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或認為可能有誤，請即刻聯繫我們：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">我們將誠摯協助您釐清與處理相關事項。</span></p>'\
            '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">一切順心、平安順利</span></p>'\
            '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
            '<p>&nbsp;</p>'\
            '<p>--------------------------------------------------------------------------------</p>'\
            '<p>&nbsp;</p>'\
            '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
            '<p><span style="font-weight: 400;">You have been removed from the following group on our platform. Details are as follows:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Group Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Removal Date</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">If you believe this action was taken in error or have any concerns, please do not hesitate to contact us:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">We are here to assist you and clarify any issues.</span></p>'\
            '<p><span style="font-weight: 400;">Wishing you all the best and continued success.</span></p>'\
            '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'
    send_email_gmail(remove_group_email_title, remove_group_email_body, destination)

def send_delete_account_email(k8s_name, k8s_account, k8s_date, destination):     
    delete_account_email_title = '帳號刪除通知信 ( Account Deletion Notification )'
    delete_account_email_body = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
            '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
            '<p><span style="font-weight: 400;">本信通知您，您的帳號將在指定時間自本平台系統中</span><strong>正式刪除</strong><span style="font-weight: 400;">，相關資訊如下：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>帳號名稱</strong><span style="font-weight: 400;">：' + k8s_account + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>刪除時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">自刪除生效時起，您將無法再登入本平台，並將失去所有原有權限及資料存取權。請留意，帳號一經刪除將</span><strong>無法恢復</strong><span style="font-weight: 400;">，相關個人資料與操作紀錄亦將依據資料保留政策一併處理。</span></p>'\
            '<p><span style="font-weight: 400;">如您認為本次操作有誤，或需進一步協助，歡迎儘速與我們聯繫：</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
            '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">感謝您過往對本平台的支持與使用，祝您一切順利。</span></p>'\
            '<p><span style="font-weight: 400;">此致</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">敬禮</span></p>'\
            '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
            '<p>&nbsp;</p>'\
            '<p>--------------------------------------------------------------------------------</p>'\
            '<p>&nbsp;</p>'\
            '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
            '<p><span style="font-weight: 400;">This is to inform you that your account will be </span><strong>officially deleted</strong><span style="font-weight: 400;"> from our platform at the specified time. The details are as follows:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Account Name</strong><span style="font-weight: 400;">: ' + k8s_account + '</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Scheduled Deletion Date</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">Once the deletion takes effect, you will no longer be able to log into the platform, and all existing permissions and data access rights will be revoked.</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">Please note that </span><strong>deleted accounts cannot be restored</strong><span style="font-weight: 400;">, and all related personal data and activity records will be handled in accordance with our data retention policy.</span></p>'\
            '<p><span style="font-weight: 400;">If you believe this action was taken in error, or if you require further assistance, please contact us as soon as possible:</span></p>'\
            '<ul>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
            '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
            '</ul>'\
            '<p><span style="font-weight: 400;">We sincerely thank you for your past support and use of our platform, and we wish you all the best.</span></p>'\
            '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'
    send_email_gmail(delete_account_email_title, delete_account_email_body, destination)

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
    
def delete_profile(name, email, fullname):
    if name is None:
        return
    # delete profile
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()

    api_instance = client.CustomObjectsApi()
    # convert name to lower case, and deal with 'NoneType' object has no attribute 'lower'
    print("name = ", name)
    api_response = api_instance.delete_cluster_custom_object(
        group=group,
        version=version,
        plural=plural,
        name=name.lower(),
    )
    print(api_response)
    k8s_account = name
    k8s_name = fullname
    k8s_date = str(datetime.datetime.now())
    # send_email_gmail(email_title, email_body, email)
    send_delete_account_email(k8s_name, k8s_account, k8s_date, email)

def create_profile(username, email, cpu, gpu, memory, manager, fullname, password):
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
    print(profile_data)
    if cpu != '0' or cpu != 0:
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
    
    if gpu != '0' or gpu != 0:
        profile_data["spec"]["resourceQuotaSpec"]["hard"]["requests.nvidia.com/gpu"] = gpu
    print("profile_data = ", profile_data)
    api_instance = client.CustomObjectsApi()

    api_response = api_instance.create_cluster_custom_object(
        group=group,
        version=version,
        plural=plural,
        body=profile_data,
    )
    print(api_response)

    k8s_account = username
    k8s_password = password
    k8s_name = fullname
    # send_email_gmail(email_title, email_body, email)
    send_add_account_email(k8s_name, k8s_account, k8s_password, email)

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
        print("cpu = ", cpu)
        cpudecimal = float(cpu)
        cpudecimal = cpudecimal/10
        cpupinteger = float(cpu)
        cpufinal = cpupinteger+cpudecimal
        resourceQuotaSpec["hard"]["requests.cpu"] = str(cpufinal)

    if str(memoryStr) != '0Gi':
        memoryIntStr = memoryStr[:-2]
        # memorydecimal = float(memoryIntStr)
        # memorydecimal = memorydecimal/10
        # memoryinteger = float(memoryIntStr)
        # memoryfinal = memorydecimal+memoryinteger
        memoryinteger = float(memoryIntStr)
        memoryfinal = memoryinteger + 2 # add 2Gi to the memory
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

    ### get the user info from database
    for user in User.objects.filter(groups=group):
        profileName = get_profile_by_email(user.email)
        replace_profile(profileName,cpuQuota,gpuQuota,memQuota)
        permission = get_permission(user.username, labname)
        print("permission = ", permission)
        manager = 'user'
        if permission == 'admin':
            manager = 'manager'
        elif permission == 'user':
            manager = 'user'
        print("manager = ", manager)
        profileName = get_profile_by_email(user.email)
        replace_profile_user(profileName, manager,cpuQuota,gpuQuota,memQuota)

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
    password_ori = data['password']
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
            # 刪除該 entry
            conn.delete(entry.entry_dn)
            # 不 return，繼續執行
            #return Response(status=500, data={"message": "Username is exist from ldap and the email is {}, username is {}".format(entry.mail.value, entry.cn.value)})
    except:
        pass
        
    user = User.objects.create_user(username=username, password=password, first_name=firstname, last_name=lastname, email=data['email'])
    user.groups.add(Group.objects.get(name=labname))
    k8s_date = str(datetime.datetime.now())
    k8s_name = user.first_name + " " + user.last_name
    send_add_group_email(k8s_name, labname, k8s_date, email)
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
    k8s_password = password_ori
    k8s_name = firstname + ' ' + lastname
    create_profile(username=username, email=email,cpu=cpu_quota, gpu=gpu_quota, memory=mem_quota, manager=manager, fullname=k8s_name, password=k8s_password)

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
        k8s_date = str(datetime.datetime.now())
        k8s_name = user.first_name + " " + user.last_name
        send_delete_group_email(k8s_name, group, k8s_date, user.email)
    user.groups.add(Group.objects.get(name='root'))
    k8s_date = str(datetime.datetime.now())
    k8s_name = user.first_name + " " + user.last_name
    send_add_group_email(k8s_name, 'root', k8s_date, user.email)
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

def get_user_all_groups(user):
    user = User.objects.get(username=user)
    # get current group
    group_list = []
    for group in user.groups.all():
        ## add permission and groupname into list
        group_list.append({"permission": get_permission(user.username, group.name), "groupname": group.name})
    return group_list

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
        "permission": get_user_all_groups(user_obj.username),
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
    k8s_name = user_obj.first_name + ' ' + user_obj.last_name
    k8s_email = user_obj.email    
    User.objects.get(username=username).delete()
    delete_profile(profileName, k8s_email, k8s_name)

@api_view(['POST'])
def user_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    deleteUserModel(data['username'])
    return Response(status=200)

@api_view(['POST'])
def lab_delete(request):
    data = json.loads(request.body.decode('utf-8'))
    labname = data['lab']
    group = Group.objects.get(name=labname)
    for user in User.objects.filter(groups=group):
        User.objects.get(username=user).groups.remove(Group.objects.get(name=labname))
        UserDetail.objects.get(uid=User.objects.get(username=user).id, labname=Group.objects.get(name=labname)).delete()
        group_list = get_user_all_groups(user)
        k8s_date = str(datetime.datetime.now())
        k8s_name = user.first_name + " " + user.last_name
        send_delete_group_email(k8s_name, labname, k8s_date, user.email)
        # print(group_list)
        # check if group is empty
        if len(group_list) == 0:
            print("group is empty")
            deleteUserModel(user)
        else:
            print("group is not empty -", len(group_list))
        print(user.username)
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
            profileName = get_profile_by_email(user_obj.email)
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
                            user = User.objects.get(username=row[0].value)
                            k8s_date = str(datetime.datetime.now())
                            k8s_name = user.first_name + " " + user.last_name
                            send_add_group_email(k8s_name, row[1].value, k8s_date, user.email)
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
            k8s_date = str(datetime.datetime.now())
            k8s_name = user_obj.first_name + " " + user_obj.last_name
            send_add_group_email(k8s_name, row[1].value, k8s_date, user_obj.email)
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
    # get the permission of the user
    # print("Lance - ",user, group)
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

            #try:
            #    cpu = profile['spec']['resourceQuotaSpec']['hard']['requests.cpu']
            #except:
            #    cpu = "0"
            #try:
            #    gpu = profile['spec']['resourceQuotaSpec']['hard']['requests.nvidia.com/gpu']
            #except:
            #    gpu = "0"
            #try:
            #    memory = profile['spec']['resourceQuotaSpec']['hard']['requests.memory']
            #    memory = memory[:-2]
            #except:
            #    memory = "0"
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
            k8s_date = str(datetime.datetime.now())
            k8s_name = user_obj.first_name + " " + user_obj.last_name
            send_add_group_email(k8s_name, lab, k8s_date, user_obj.email)
            return Response(status=200)
        except:
            return Response(status=500)
    else:
        try:
            UserDetail.objects.create(uid=user_obj, permission=2, labname=Group.objects.get(name=lab))
            user_obj.groups.add(Group.objects.get(name=lab))
            k8s_date = str(datetime.datetime.now())
            k8s_name = user_obj.first_name + " " + user_obj.last_name
            send_add_group_email(k8s_name, lab, k8s_date, user_obj.email)
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

            # add try error control below
            # try:
            #    cpu = profile['spec']['resourceQuotaSpec']['hard']['requests.cpu']
            # except:
            #    cpu = "0"
            # try:
            #    gpu = profile['spec']['resourceQuotaSpec']['hard']['requests.nvidia.com/gpu']
            # except:
            #    gpu = "0"
            # try:
            #    memory = profile['spec']['resourceQuotaSpec']['hard']['requests.memory']
            #    memory = memory[:-2]
            # except:
            #     memory = "0"
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

def is_number(val):
    try:
        float(val)
        return True
    except (TypeError, ValueError):
        return False
    
@api_view(['POST'])
def import_lab_user(request):
    group = request.POST['lab']
    
    # check the group is exist or not
    if Group.objects.filter(name=group).exists() is False:
        return JsonResponse({'message': 'lab {} is not exist'.format(group)}, status=400)
    group_obj = Group.objects.get(name=group)
    # get group default resource quota
    group_resource_obj = GroupDefaultQuota.objects.get(labname=group_obj)
    group_default_cpu_quota = group_resource_obj.cpu_quota
    group_default_gpu_quota = group_resource_obj.gpu_quota
    group_default_mem_quota = group_resource_obj.mem_quota
    
    
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
            # check value email
            if row[2].value is None:
                return JsonResponse({'message': 'user {} email is empty'.format(row[0].value)}, status=400)
            
            # check value permission
            if row[5].value != 'admin' and row[5].value != 'user':
                row[5].value = 'user'
                
            if row[6].value is None:
                row[6].value = group_default_cpu_quota
            else:
                # if cpu value is not integer, remove m and devide to 8
                # 確保 value 是字串，方便後續處理
                value = str(row[6].value)

                # 如果不是整數也不是浮點數，砍掉最後一個字元
                if not is_number(value):
                    value = value[:-1]
                row[6].value = value

                # if str(row[6].value).isdigit() is False:
                #    row[6].value = row[6].value[:-1]
                if float(row[6].value) > 1100:
                    row[6].value = str(float(row[6].value)/1100)
                    
            
            if row[7].value is None:
                row[7].value = group_default_gpu_quota
            
            if row[8].value is None:
                row[8].value = group_default_mem_quota
                
            user = {
                "username": row[0].value.lower(),
                "password": row[1].value,
                "email": row[2].value.lower(),
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
                # remove the user from userinfo
                userinfo.remove(user)
                continue
            if User.objects.filter(email=user['email']).exists() is True:
                # "username":"reason"
                failed_user.append({user['username']: "email is exist in database"})
                userinfo.remove(user)
                continue
            # if user is exist in kubeflow
            if get_profile_by_email(user['email']) is not None:
                failed_user.append({user['username']: "email is exist in kubeflow"})
                userinfo.remove(user)
                continue

            # if user is exist in ldap, Lance - must check in the last step, because if user is exist in ldap, it will be deleted
            try:
                conn = connectLDAP()
                conn.search('cn={},ou=users,dc=example,dc=org'.format(user['username']), '(objectclass=posixAccount)', attributes=['*'])
                for entry in conn.entries:
                    #. failed_user.append({user['username']: "username is exist in ldap"})
                    # userinfo.remove(user)
                    # continue
                    # 刪除該 entry
                    conn.delete(entry.entry_dn)
                    # 不 pass，繼續執行
            except:
                pass

        # add user into django, ldap, and kubeflow
        for user in userinfo:
            # convert cpu value to correct format, from 8800m remove m and devide to 8 ,  if more than 1100
            print("Without check", user['cpu_quota'])
            if str(user['cpu_quota']).isdigit() is False:
                user['cpu_quota'] = user['cpu_quota'][:-1]
            print("After check1", user['cpu_quota'])
            if float(user['cpu_quota']) > 1100:
                user['cpu_quota'] = str(float(user['cpu_quota'])/1100)
            print("After check2", user['cpu_quota'])
            try:
                if int(user['mem_quota']) > 1100:
                    user['mem_quota'] = str(float(user['mem_quota'])/1100)
            except:
                user['mem_quota'] = '0'
            
            try:
                User.objects.create_user(username=user['username'], password=user['password'], first_name=user['firstname'], last_name=user['lastname'], email=user['email'])
                user_obj = User.objects.get(username=user['username'])
                user_obj.groups.add(Group.objects.get(name=group))
                k8s_date = str(datetime.datetime.now())
                k8s_name = user_obj.first_name + " " + user_obj.last_name
                send_add_group_email(k8s_name, group, k8s_date, user_obj.email)
                if user['permission'] == 'admin':
                    UserDetail.objects.create(uid=user_obj, permission=1, labname=Group.objects.get(name=group))
                elif user['permission'] == 'user':
                    UserDetail.objects.create(uid=user_obj, permission=2, labname=Group.objects.get(name=group))
            except:
                failed_user.append({user['username']: "user add into database failed"})
                continue
            
            # convert user['cpu_quota'], user['gpu_quota'] and user['mem_quota'] to correct format str
            user['cpu_quota'] = str(user['cpu_quota'])
            user['gpu_quota'] = str(user['gpu_quota'])
            user['mem_quota'] = str(user['mem_quota'])        
    
            try:
                # add user into kubeflow's profile
                k8s_password = row[1].value
                k8s_name = row[3].value + ' ' + row[4].value
                create_profile(username=user['username'], email=user['email'],cpu=user['cpu_quota'], gpu=user['gpu_quota'], memory=user['mem_quota'], manager=user['permission'], fullname=k8s_name, password=k8s_password)
            except:
                # if user is not added into kubeflow, remove the user from database
                print(traceback.format_exc())
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
        # group_list = get_user_all_groups(user)
        # print(group_list)
        User.objects.get(username=user).groups.remove(Group.objects.get(name=lab))
        UserDetail.objects.get(uid=User.objects.get(username=user).id, labname=Group.objects.get(name=lab)).delete()
        group_list = get_user_all_groups(user)
        user_obj = User.objects.get(username=user)
        k8s_date = str(datetime.datetime.now())
        k8s_name = user_obj.first_name + " " + user_obj.last_name
        send_delete_group_email(k8s_name, lab, k8s_date, user_obj.email)
        # print(group_list)
        # check if group is empty
        if len(group_list) == 0:
            print("group is empty")
            deleteUserModel(user)
        else:
            print("group is not empty -", len(group_list))
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
        group_list = get_user_all_groups(user)
        user_obj = User.objects.get(username=user)
        k8s_date = str(datetime.datetime.now())
        k8s_name = user_obj.first_name + " " + user_obj.last_name
        send_delete_group_email(k8s_name, group, k8s_date, user_obj.email)
        # print(group_list)
        # check if group is empty
        if len(group_list) == 0:
            print("group is empty")
            deleteUserModel(user)
        else:
            print("group is not empty -", len(group_list))
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

def remove_null(data):
    if isinstance(data, dict):
        removed = dict()
        for k, v in data.items():
            cleaned = remove_null(v)
            if not(cleaned in [None, {}, []]):
                removed[k] = cleaned
    elif isinstance(data, list):
        removed = list()
        for v in data:
            cleaned = remove_null(v)
            if not(cleaned in [None, {}, []]):
                removed.append(cleaned)
    else:
        return data
    return removed

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
        del notebook_yaml["metadata"]["annotations"]
        del notebook_yaml["metadata"]["managedFields"]
        notebook_yaml["spec"]["template"]["spec"]["containers"][0]["image"] = "cguaicadmin/remote-desktop:V1.0.7"
        # try:
        #     del notebook_yaml["metadata"]["annotations"]
        # except Exception as e: 
        #     pass
        # notebook_yaml["spec"]["template"]["spec"]["containers"][0]["image"] = "cguaicadmin/remote-desktop-eng:V1.0.7"

        # get pvc.yaml (may be more than 1)
        pvc_names = []
        for volume in notebook_yaml["spec"]["template"]["spec"]["volumes"][1:]:
            pvc_names.append(volume["persistentVolumeClaim"]["claimName"])
        v1 = client.CoreV1Api()
        pvc_yamls = []
        for name in pvc_names:
            pvc_yaml = v1.read_namespaced_persistent_volume_claim(name, data["namespace"])
            pvc_yaml = pvc_yaml.to_dict()
            pvc_yaml = humps.camelize(pvc_yaml)
            del pvc_yaml["metadata"]["annotations"]
            del pvc_yaml["metadata"]["creationTimestamp"]
            del pvc_yaml["metadata"]["finalizers"]
            del pvc_yaml["metadata"]["resourceVersion"]
            del pvc_yaml["metadata"]["uid"]
            del pvc_yaml["status"]
            del pvc_yaml["metadata"]["managedFields"]
            pv_yaml["spec"]["persistentVolumeReclaimPolicy"] = "Retain"
            pvc_yaml = remove_null(pvc_yaml)
            pvc_yamls.append(pvc_yaml)

        # get pv.yaml
        pv_names = []
        for i in range(len(pvc_yamls)):
            pv_names.append(pvc_yamls[i]["spec"]["volumeName"])
        pv_yamls = []
        for name in pv_names:
            pv_yaml = v1.read_persistent_volume(name)
            pv_yaml = pv_yaml.to_dict()
            pv_yaml = humps.camelize(pv_yaml)
            del pv_yaml["metadata"]["annotations"]
            del pv_yaml["metadata"]["creationTimestamp"]
            del pv_yaml["metadata"]["finalizers"]
            del pv_yaml["metadata"]["resourceVersion"]
            del pv_yaml["metadata"]["uid"]
            del pv_yaml["spec"]["claimRef"]["resourceVersion"]
            del pv_yaml["spec"]["claimRef"]["uid"]
            del pv_yaml["status"]
            del pv_yaml["metadata"]["managedFields"]
            pv_yaml["spec"]["persistentVolumeReclaimPolicy"] = "Retain"
            pv_yaml = remove_null(pv_yaml)
            pv_yamls.append(pv_yaml)
        response = {"notebook": notebook_yaml, "pvc": pvc_yamls, "pv": pv_yamls}
        return JsonResponse(response, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=e.status)
    
@api_view(["POST"])
def upload_notebook_yaml(request):
    if request.method == "POST" and request.FILES.get("file"):
        api_v1 = client.CoreV1Api()
        api = client.CustomObjectsApi()
        uploaded_file = request.FILES.get("file")
        namespace = request.POST.get("namespace")
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
                spec = content["spec"]
                content = humps.decamelize(file["content"])
                content["spec"] = spec
                try:
                    existed = api_v1.read_persistent_volume(content["metadata"]["name"])
                    results[content["metadata"]["name"]] = "existed"
                except Exception as e:
                    try:
                        obj = client.V1PersistentVolume(**content)
                        api_v1.create_persistent_volume(obj)
                    except Exception as e:
                        results[content["metadata"]["name"]] = str(e)
                    results[content["metadata"]["name"]] = "non-existed, created it"
            elif content["kind"] == "Notebook":
                try:
                    existed = api.get_namespaced_custom_object(
                        group="kubeflow.org",
                        version="v1",
                        plural="notebooks",
                        namespace=namespace,
                        name=content["metadata"]["name"])
                    results[content["metadata"]["name"]] = "existed"
                except Exception as e:
                    api.create_namespaced_custom_object(group="kubeflow.org",
                                                        version="v1",
                                                        plural="notebooks",
                                                        namespace=namespace,
                                                        body=content)
                    results[content["metadata"]["name"]] = "non-existed, created it"
            elif content["kind"] == "PersistentVolumeClaim":
                pvcs.append(file)
        for file in pvcs:
            spec = file["content"]["spec"]
            content = humps.decamelize(file["content"])
            content["spec"] = spec
            try:
                existed = api_v1.read_namespaced_persistent_volume_claim(content["metadata"]["name"], namespace)
                results[content["metadata"]["name"]] = "existed"
            except Exception as e:
                try:
                    obj = client.V1PersistentVolumeClaim(**content)
                    api_v1.create_namespaced_persistent_volume_claim(namespace, obj)
                except Exception as e:
                    results[content["metadata"]["name"]] = str(e)
                results[content["metadata"]["name"]] = "non-existed, created it"
        
        return JsonResponse({"files": processed_files, "results": results}, status=200)