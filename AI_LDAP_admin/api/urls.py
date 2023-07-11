from django.urls import path, re_path
from .views import *
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("userQuery/", userQuery),
    path("users/", user_list, name="user_list"),
    path("users/<int:pk>/", user_detail, name="user_detail"),
    path("syschronize_ldap/", syschronize_ldap, name="syschronize_ldap"),
    path("", getRoute, name="getRoute"),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("ldap/info/", get_group_corresponding_user, name="get_group_corresponding_user"),
]
