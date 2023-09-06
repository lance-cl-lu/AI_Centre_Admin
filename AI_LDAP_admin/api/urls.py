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
    path("ldap/lab/list/", lab_list, name="lab_list"),
    path("ldap/lab/add/", addlab, name="addlab"),
    path("ldap/lab/delete/", lab_delete, name="lab_delete"),
    path("ldap/outside/user/", outside_user, name="outside_user"),
    path("ldap/lab/insert/", add_user_to_lab, name="add_user_to_lab"),
    path("ldap/lab/excel/export/", export_lab_user, name="export_lab_user"),
    path("ldap/lab/excel/import/", import_lab_user, name="import_lab_user"),
    #user url
    path("ldap/user/", get_user_info, name="get_user_info"),
    path("ldap/user/list/", user_list, name="user_list"),
    path("ldap/user/add/", adduser, name="get_lab_info"),
    path("ldap/user/delete/", user_delete, name="user_delete"),
    
    path("ldap/admin/add/", add_admin, name="add_admin"),
    
    # about excel
    path("ldap/excel/", excel, name="excel"),
    path("ldap/excel/export/", export_ldap, name="export_ldap"),

    # about user page change
    path("password/change/", change_password, name="change_password"),
    path("user/change/", change_user_info, name="change_user_info"),
    
]
