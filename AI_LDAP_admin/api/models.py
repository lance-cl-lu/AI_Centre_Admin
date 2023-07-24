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