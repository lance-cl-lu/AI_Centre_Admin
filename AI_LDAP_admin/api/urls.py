from django.urls import path, re_path
from .views import *
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("home/", user_group_num, name="user_group_num"),
    path("syschronize_ldap/", syschronize_ldap, name="syschronize_ldap"),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("ldap/info/", get_group_corresponding_user, name="get_group_corresponding_user"),
    path("ldap/lab/", get_lab_info, name="get_lab_info"),
    path("ldap/lab/list/", lab_list, name="lab_list"),
    path("ldap/lab/add/", addlab, name="addlab"),
    path("ldap/user/", get_user_info, name="get_user_info"),
    path("ldap/user/list/", user_list, name="user_list"),
    path("ldap/user/add/", adduser, name="get_lab_info"),
    path("ldap/admin/add/", add_admin, name="add_admin"),
]
