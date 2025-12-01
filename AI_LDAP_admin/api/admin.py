from django.contrib import admin
from .models import UserDetail, GroupDefaultQuota, UserGPUQuotaType, DeletedUser, PendingDeletion

# Register your models here.
admin.site.site_header = 'AI LDAP Admin'
admin.site.register(UserDetail)
admin.site.register(GroupDefaultQuota, name="GroupDefaultQuota")
admin.site.register(UserGPUQuotaType, name="UserGPUQuotaType")

@admin.register(DeletedUser)
class DeletedUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'deletion_date', 'deletion_reason', 'deleted_by')
    list_filter = ('deletion_date', 'deletion_reason')
    search_fields = ('username', 'email', 'deleted_by')
    readonly_fields = ('deletion_date',)
    ordering = ('-deletion_date',)

@admin.register(PendingDeletion)
class PendingDeletionAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'removal_date', 'scheduled_deletion_date', 'days_until_deletion', 'removal_reason')
    list_filter = ('removal_date', 'scheduled_deletion_date', 'removal_reason')
    search_fields = ('username', 'email', 'removed_by')
    readonly_fields = ('removal_date', 'days_until_deletion')
    ordering = ('scheduled_deletion_date',)
    
    def days_until_deletion(self, obj):
        return f"{obj.days_until_deletion} 天"
    days_until_deletion.short_description = "剩餘天數"
