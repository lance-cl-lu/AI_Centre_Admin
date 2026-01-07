# Generated manually for adding expiry_date to UserDetail

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_add_expiry_date_to_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='userdetail',
            name='expiry_date',
            field=models.DateField(blank=True, help_text='使用者到期日期', null=True),
        ),
    ]
