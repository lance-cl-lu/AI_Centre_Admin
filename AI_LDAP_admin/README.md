# Backend
Using django

## Scripts

### Dockerfile
Using to create docker image


##### Build Docker

```
docker build -t ldap_backend . --no-cache
docker tag ldap_backend cguaicadmin/ldap_backend:v0.2.XX
docker login
docker push cguaicadmin/ldap_backend:v0.2.XX
```

##### Deployment

```
kubectl edit deploy backend-deployment -n ldap
kubectl rollout restart deploy backend-deployment -n ldap
```

##### Pod

```
kubectl exec -n ldap backend-deployment-6f68559d45-k6qsm -it -- bash
```

##### log

```
kubectl logs backend-deployment-6f68559d45-k6qsm -n ldap
```
---
### update.sh
Update the compiled frontend to static
```
[ -d frontend/templates/ ] || mkdir frontend/templates/
[ -d frontend/templates/frontend/ ] || mkdir frontend/templates/frontend/
cp -f ../frontend/build/index.html frontend/templates/frontend/
rm -rf static
mkdir static
cp -a ../frontend/build/* static/
cp -a ../frontend/icons/* static/
rm -f static/index.html

sed -i 's/"\/manifest.json"/"{% static "\/manifest.json" %}"/' frontend/templates/frontend/index.html 
sed -i 's/"\/static\/js\/main./"{% static "\/static\/js\/main./' frontend/templates/frontend/index.html
sed -i 's/.js"/.js" %}"/' frontend/templates/frontend/index.html 
sed -i 's/"\/static\/css\/main./"{% static "\/static\/css\/main./' frontend/templates/frontend/index.html
sed -i 's/.css"/.css" %}"/' frontend/templates/frontend/index.html 
```

```
<!doctype html><html lang="en"><head><meta charset="utf-8"/>{% load static %}<title>CGU AI Center Ldap Management System</title><link rel="shortcut icon" type="image" href="{% static 'favicon.ico' %}"><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#000000"/><meta name="description" content="Web site created using create-react-app"/><link rel="apple-touch-icon" href="/logo192.png"/><link rel="manifest" href="{% static "/manifest.json" %}"/><script defer="defer" src="{% static "/static/js/main.8eda82a3.js" %}"></script><link href="{% static "/static/css/main.7695d4f4.css" %}" rel="stylesheet"></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>root@devmaster:/home
```
---
### upload_frontend_ldap.sh
Update the compiled frontend to Docker

---
### upload_backend_ldap.sh
Update the backend python to Docker

## Architecture

##### urls.py

```
from django.urls import path, re_path
from .views import *
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("check/syschronize/", db_ldap_check, name="db_ldap_check"),
    path("home/", user_group_num, name="user_group_num"),
    path("syschronize_ldap/", syschronize_ldap, name="syschronize_ldap"),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("ldap/info/", get_group_corresponding_user, name="get_group_corresponding_user"),
    
    # lab url
    path("ldap/lab/", get_lab_info, name="get_lab_info"),
    path("ldap/lab/edit/", editlab, name="editlab"),
    path("ldap/lab/default_values/", get_default_values, name="get_default_values"),
    path("ldap/lab/list/", lab_list, name="lab_list"),
    path("ldap/lab/add/", addlab, name="addlab"),
    path("ldap/lab/delete/", lab_delete, name="lab_delete"),
    path("ldap/outside/user/", outside_user, name="outside_user"),
    path("ldap/lab/insert/", add_user_to_lab, name="add_user_to_lab"),
    path("ldap/lab/excel/export/", export_lab_user, name="export_lab_user"),
    path("ldap/lab/excel/import/", import_lab_user, name="import_lab_user"),
    path("ldap/lab/remove/", remove_user_from_lab, name="remove_user_from_lab"),
    path("ldap/lab/mutiple/remove/", remove_multiple_user_from_lab, name="remove_multiple_user_from_lab"),
    
    #user url
    path("ldap/user/", get_user_info, name="get_user_info"),
    path("ldap/user/list/", user_list, name="user_list"),
    path("ldap/user/add/", adduser, name="get_lab_info"),
    path("ldap/user/delete/", user_delete, name="user_delete"),
    path("ldap/user/mutiple/delete/", multiple_user_delete, name="multiple_lab_delete"),
    
    path("ldap/admin/add/", add_admin, name="add_admin"),
    
    # about excel
    path("ldap/excel/", excel, name="excel"),
    path("ldap/excel/export/", export_ldap, name="export_ldap"),
    path("ldap/excel/template/", template, name="excel_template"),
    # about user page change
    path("password/change/", change_password, name="change_password"),
    path("user/change/", change_user_info, name="change_user_info"),

    path("notebook/", list_notebooks, name="get_notebooks"),
    path("setNotebook/", set_notebook, name="set_notebook"),
    path("getNotebookYAML/", get_notebook_yaml, name="get_notebook_yaml"),
    path("uploadNotebookYAML/", upload_notebook_yaml, name="upload_notebook_yaml"),
    # danger for deploy
    # path("ldap/danger/", remove_all_entr, name="danger"),
]

# LDAP_IP = '120.126.23.245'
# LDAP_PORT = '31979'

LDAP_IP = 'openldap.default.svc.cluster.local'
LDAP_PORT = '389'
# LDAP_IP = '192.168.8.109'
# LDAP_PORT = '32029'

def get_url():
    return 'ldap://'+LDAP_IP+':'+LDAP_PORT

```

##### view.py

```
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
        conn.unbind()
            
        user = User.objects.get(username=username)
        user.first_name = firstname
        user.last_name = lastname
        user.email = email
        user.save()

        ...
        
        replace_profile_user(profileName, manager, str(cpu_quota), str(gpu_quota), str(mem_quota))
        return Response(status=200)
    except:
        return Response(status=500)
```

## k8s system

##### full-stack-deployment.yaml
1. Namespace  
2. Deployment  
3. PersistentVolumeClaim
4. Service
5. ServiceAccount

## k8s permission


1. cluster-role-binding.yaml  
2. cluster-role.yaml   
3. role-binding.yaml 
4. role.yaml

## Others

1. sync k8s profiles  
2. sync k8s namespace  
3. sync k8s notebook
4. sync Diango DB
5. sync ldap

