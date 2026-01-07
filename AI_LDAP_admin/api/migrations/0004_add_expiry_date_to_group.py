# Generated manually for adding expiry_date to GroupDefaultQuota

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_usergpuquotatype'),
    ]

    operations = [
        migrations.AddField(
            model_name='groupdefaultquota',
            name='expiry_date',
            field=models.DateField(blank=True, help_text='群組到期日期', null=True),
        ),
    ]