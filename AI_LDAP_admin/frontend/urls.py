from django.urls import path, re_path
from . import views
urlpatterns = [
    path('', views.index, name='index'),
    path('pending-deletion/', views.index, name='pending_deletion_page'),
    path('login/', views.index, name='login_page'),
    path('home/', views.index, name='home_page'),
    # Add other specific frontend routes as needed
    re_path(r'^(?!api/)(?!admin/)(?!swagger)(?!redoc).*/$', views.index),
]