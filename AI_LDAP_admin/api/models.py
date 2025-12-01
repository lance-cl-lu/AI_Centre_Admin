from django.db import models
from django.contrib.auth.models import User, Group

class UserDetail(models.Model):
    uid = models.ForeignKey(User, on_delete=models.CASCADE)
    permission = models.IntegerField(range(0, 2), default=2)
    labname = models.ForeignKey(Group, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ('uid', 'labname','permission')
        
    
    def __str__(self):
        return self.uid.username + '\t' + self.labname.name + '\t' + str(self.permission)
    
from passlib.hash import ldap_md5
from django.contrib.auth.hashers import BasePasswordHasher

class PasslibLDAPMD5PasswordHasher(BasePasswordHasher):
    algorithm = "passlib_ldap_md5"

    def encode(self, password, salt):
        assert password is not None

        # Use passlib to hash the password using ldap_md5
        hashed_password = ldap_md5.hash(password)

        # Return the encoded password
        return f'{self.algorithm}${hashed_password}'

    def verify(self, password, encoded):
        algorithm, hashed_password = encoded.split('$', 1)
        assert algorithm == self.algorithm

        # Use passlib to verify the password against the hashed value
        return ldap_md5.verify(password, hashed_password)

    def safe_summary(self, encoded):
        algorithm, hashed_password = encoded.split('$', 1)
        return {
            'algorithm': algorithm,
            'hash': hashed_password,
        }
    def set_password(self, password):
        self.password = ldap_md5.hash(password)
        
class GroupDefaultQuota(models.Model):
    labname = models.ForeignKey(Group, on_delete=models.CASCADE)
    cpu_quota = models.IntegerField(default=8)
    mem_quota = models.IntegerField(default=16)
    gpu_quota = models.IntegerField(default=1)
    gpu_vendor = models.CharField(max_length=100, default='NVIDIA', null=True)
    expiry_date = models.DateField(null=True, blank=True, help_text="群組到期日期")
    
    class Meta:
        unique_together = ('labname',)
        
    @property
    def remaining_days(self):
        """計算剩餘天數"""
        if not self.expiry_date:
            return None
        from datetime import date
        delta = self.expiry_date - date.today()
        return delta.days
        
    @property
    def is_expired(self):
        """檢查是否已到期"""
        if not self.expiry_date:
            return False
        from datetime import date
        return self.expiry_date <= date.today()
        
    def __str__(self):
        return self.labname.name
        
class UserGPUQuotaType(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    gpuType = models.CharField(max_length=100, default='NVIDIA', null=True)
    
    class Meta:
        unique_together = ('user',)
    
    def __str__(self):
        return self.user.username + '\t' + self.gpuType


class DeletedUser(models.Model):
    """
    Model to store information about deleted users for record keeping.
    When a user is deleted from the system, their information is archived here.
    """
    username = models.CharField(max_length=150)
    email = models.EmailField()
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    original_groups = models.TextField(help_text="Comma-separated list of groups the user belonged to")
    deletion_date = models.DateTimeField(auto_now_add=True)
    deletion_reason = models.CharField(max_length=255, blank=True, null=True, help_text="Reason for deletion (e.g., 'expired', 'manual', 'admin action')")
    deleted_by = models.CharField(max_length=150, blank=True, null=True, help_text="Username of admin who deleted this user")
    
    # Store additional user data as JSON for flexibility
    additional_data = models.JSONField(blank=True, null=True, help_text="Additional user metadata stored as JSON")
    
    class Meta:
        ordering = ['-deletion_date']
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['deletion_date']),
        ]
    
    def __str__(self):
        return f"{self.username} (deleted on {self.deletion_date.strftime('%Y-%m-%d')})"


class PendingDeletion(models.Model):
    """
    Model to track users who have been removed from groups and are pending deletion.
    Shows how many days remain until permanent deletion.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    username = models.CharField(max_length=150)  # Backup in case user is deleted
    email = models.EmailField()
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    removed_from_groups = models.TextField(help_text="Comma-separated list of groups user was removed from")
    removal_date = models.DateTimeField(auto_now_add=True)
    scheduled_deletion_date = models.DateTimeField(help_text="Date when user will be permanently deleted")
    removal_reason = models.CharField(max_length=255, blank=True, null=True, help_text="Reason for group removal")
    removed_by = models.CharField(max_length=150, blank=True, null=True, help_text="Admin who removed user from groups")
    
    class Meta:
        ordering = ['scheduled_deletion_date']
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['scheduled_deletion_date']),
            models.Index(fields=['removal_date']),
        ]
    
    def __str__(self):
        return f"{self.username} (deletion scheduled for {self.scheduled_deletion_date.strftime('%Y-%m-%d')})"
    
    @property
    def days_until_deletion(self):
        """Calculate how many days remain until deletion"""
        from django.utils import timezone
        delta = self.scheduled_deletion_date - timezone.now()
        return max(0, delta.days)
    
