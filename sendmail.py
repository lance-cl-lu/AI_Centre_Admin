import smtplib, ssl
from email.mime.text import MIMEText


def send_email_gmail(subject, message, destination):
    # First assemble the message
    msg = MIMEText(message, 'html')
    msg['Subject'] = subject

    # Login and send the message
    port = 465
    my_mail = 'support01@twentyfouri.com'
    my_password = 'czyq oonp vyxd inor'
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL('smtp.gmail.com', port, context=context) as server:
        server.login(my_mail, my_password)
        server.sendmail(my_mail, destination, msg.as_string())

email_body = """<pre> 
Congratulations! We've successfully created account.
Go to the page: <a href="https://www.google.com/">click here</a>
Thanks,
XYZ Team.
</pre>"""

k8s_account = 'yc'
k8s_password = '12345678'
k8s_name = 'yc wang'
email_body2 = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' ，</span></p>'\
        '<p><span style="font-weight: 400;">您好！</span><span style="font-weight: 400;"><br /></span>'\
        '<span style="font-weight: 400;">感謝您加入我們的服務，以下是您的帳號資訊：</span></p>' \
        '<ul>' \
        '<li style="font-weight: 400;" aria-level="1"><strong>使用者名稱</strong><span style="font-weight: 400;">：</span>'\
        '<span style="font-weight: 400;">' + k8s_account + '</span></li>' \
        '<li style="font-weight: 400;" aria-level="1"><strong>密碼</strong>'\
        '<span style="font-weight: 400;">：</span><span style="font-weight: 400;">' + k8s_password +'</span></li>' \
        '</ul>' \
        '<p><span style="font-weight: 400;">為了確保您的帳號安全，請您在首次登入後立即修改密碼。</span></p>' \
        '<p><span style="font-weight: 400;">我們為您準備了一份詳細的使用手冊，幫助您快速熟悉系統功能，您可以透過以下連結查看：</span>'\
        '<span style="font-weight: 400;"><br /></span><a href="https://zh.wikipedia.org/zh-tw/%E8%B6%85%E6%96%87%E6%9C%AC%E4%BC%A0%E8%BE%93%E5%8D%8F%E8%AE%AE">'\
        '<span style="font-weight: 400;">點擊這裡下載使用手冊</span></a></p>' \
        '<p><span style="font-weight: 400;">如果您在使用過程中遇到任何問題，歡迎隨時聯繫我們的客服團隊，我們將竭誠為您服務。</span></p>' \
        '<p><strong>&nbsp;</strong></p>' \
        '<p><span style="font-weight: 400;">祝您使用愉快！</span></p>' \
        '<p><strong><br /><span style="font-weight: 400;">此致</span>'\
        '<span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">長庚大學 AI 中心</span>'\
        '<span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></strong></p>'

# send_email_gmail('您的帳號已成功建立', '親愛的 王大明，\r\n\r\n您好！\r\n感謝您加入我們的服務，以下是您的帳號資訊：\r\n', "lance.cl.lu@gmail.com")

send_email_gmail('您的帳號已成功建立', email_body2, "lance.cl.lu@gmail.com")
