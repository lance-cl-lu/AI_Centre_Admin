from django.urls import path, re_path
from . import views
urlpatterns = [
    path('announcement', views.index),
    path('announcement/', views.index),
    re_path(r'^(?!favicon\.ico).*$', views.index),
]