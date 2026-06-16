from django.db import models
from django.contrib.auth.models import User, Group

class UserDetail(models.Model):
    uid = models.ForeignKey(User, on_delete=models.CASCADE)
    permission = models.IntegerField(range(0, 2), default=2)
    labname = models.ForeignKey(Group, on_delete=models.CASCADE)
    expiry_date = models.DateField(null=True, blank=True, help_text="使用者到期日期")
    
    class Meta:
        unique_together = ('uid', 'labname','permission')
        
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
    