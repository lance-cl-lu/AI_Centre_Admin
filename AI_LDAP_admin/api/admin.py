from django.contrib import admin
from .models import UserDetail

# Register your models here.
admin.site.site_header = 'AI LDAP Admin'
admin.site.register(UserDetail)