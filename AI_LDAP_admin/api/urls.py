from django.urls import path, re_path
from .views import *

urlpatterns = [
    path("userQuery/", userQuery),
    path("users/", user_list, name="user_list"),
    path("users/<int:pk>/", user_detail, name="user_detail"),
    path("syschronize_ldap/", syschronize_ldap, name="syschronize_ldap"),
]
