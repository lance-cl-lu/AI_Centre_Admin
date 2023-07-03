from django.db import models
from django.contrib.auth.models import AbstractBaseUser
import hashlib
from django.contrib.auth.hashers import make_password, check_password
# Create your models here.

class User(AbstractBaseUser):
    username = models.CharField(max_length=20, unique=True)
    password = models.CharField(max_length=20)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['password']
    permission_level = models.IntegerField(range(0, 2), default=0) # 0 for normal user, 1 for admin, 2 for super admin
    def __str__(self):
        return self.username
    def autherize(self, password):
        return check_password(password, self.password)
    def createsuperuser(self, username, password):
        self.username = username
        self.password = make_password(password)
        self.permission_level = 2
        self.save()
    def createuser(self, username, password):
        self.username = username
        self.password = make_password(password)
        self.permission_level = 0
        self.save()
    def chagepassword(self, password):
        self.password = make_password(password)
        self.save()