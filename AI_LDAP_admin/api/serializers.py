from rest_framework import serializers
from django.contrib.auth.models import User, Group
from .models import UserDetail
from ldap3 import *


def connectLDAP():
    server = Server('ldap://120.126.23.245:31979')
    conn = Connection(server, user='cn=admin,dc=example,dc=org', password='Not@SecurePassw0rd', auto_bind=True)
    return conn

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

## Serializers group and corresponding user
class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'
    
    


from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        conn = connectLDAP()
        print(conn)
        # Add custom claims
        token['username'] = user.username
        # get permission from ldap user description. only labname is user, permission is 2; labnameadmin is admin, permission is 1, admin is superuser, permission is 0
        try:
            conn.search('cn={},ou=users,dc=example,dc=org'.format(str(user.username)), '(objectclass=posixAccount)', attributes=['description'])
            token['permission'] = conn.entries[0].description.value
        except:
            pass
        # ...
        return token

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer