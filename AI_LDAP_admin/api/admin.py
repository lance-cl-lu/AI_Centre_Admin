from django.contrib import admin
from .models import UserDetail, GroupDefaultQuota, UserGPUQuotaType

# Register your models here.
admin.site.site_header = 'AI LDAP Admin'
admin.site.register(UserDetail)
admin.site.register(GroupDefaultQuota, name="GroupDefaultQuota")
admin.site.register(UserGPUQuotaType, name="UserGPUQuotaType")