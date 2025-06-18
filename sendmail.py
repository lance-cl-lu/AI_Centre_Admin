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
k8s_group = 'AI'
k8s_date = '2023/10/10'

email_body2C = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">感謝您註冊並使用本中心提供之雲端服務，以下為您的帳號資訊：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>使用者名稱</strong><span style="font-weight: 400;">：' + k8s_account + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>初始密碼</strong><span style="font-weight: 400;">：' + k8s_password + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">為保障您的帳號安全，建議您於首次登入後</span><strong>立即變更密碼</strong><span style="font-weight: 400;">。</span></p>'\
        '<p><span style="font-weight: 400;">此外，我們已為您準備完整的使用手冊，協助您快速上手系統操作。請點選以下連結下載：</span></p>'\
        '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://zh.wikipedia.org/zh-tw/%25E8%25B6%2585%25E6%2596%2587%25E6%259C%25AC%25E4%25BC%25A0%25E8%25BE%2593%25E5%258D%258F%25E8%25AE%25AE&amp;source=gmail&amp;ust=1746025313613000&amp;usg=AOvVaw3wGP8hFGfkeIbNPzuv8l5p">點擊這裡下載使用手冊</a></span></p>'\
        '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或非本人授權操作，請立即與我們聯繫，我們將盡速為您處理：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">使用順利、萬事如意</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body2E = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">Thank you for registering and using the cloud services provided by our center. Below are your account details:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Username</strong><span style="font-weight: 400;">: ' + k8s_account + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Initial Password</strong><span style="font-weight: 400;">: ' + k8s_password + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">To ensure the security of your account, we strongly recommend changing your password immediately upon your first login.</span></p>'\
        '<p><span style="font-weight: 400;">We have also prepared a comprehensive user manual to help you get started with the system. You can download it via the following link:</span></p>'\
        '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI&amp;source=gmail&amp;ust=1746082963524000&amp;usg=AOvVaw06m_RAtCuMh0naKiU9sUYV"> download it via click the link</a></span></p>'\
        '<p><span style="font-weight: 400;">If you have any questions or did not authorize this action, please contact us immediately. We will assist you as soon as possible:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">Wishing you a smooth and successful experience.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body2 = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">感謝您註冊並使用本中心提供之雲端服務，以下為您的帳號資訊：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>使用者名稱</strong><span style="font-weight: 400;">：' + k8s_account + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>初始密碼</strong><span style="font-weight: 400;">：' + k8s_password + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">為保障您的帳號安全，建議您於首次登入後</span><strong>立即變更密碼</strong><span style="font-weight: 400;">。</span></p>'\
        '<p><span style="font-weight: 400;">此外，我們已為您準備完整的使用手冊，協助您快速上手系統操作。請點選以下連結下載：</span></p>'\
        '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://zh.wikipedia.org/zh-tw/%25E8%25B6%2585%25E6%2596%2587%25E6%259C%25AC%25E4%25BC%25A0%25E8%25BE%2593%25E5%258D%258F%25E8%25AE%25AE&amp;source=gmail&amp;ust=1746025313613000&amp;usg=AOvVaw3wGP8hFGfkeIbNPzuv8l5p">點擊這裡下載使用手冊</a></span></p>'\
        '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或非本人授權操作，請立即與我們聯繫，我們將盡速為您處理：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">使用順利、萬事如意</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
        '<p>&nbsp;</p>'\
        '<p>--------------------------------------------------------------------------------</p>'\
        '<p>&nbsp;</p>'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">Thank you for registering and using the cloud services provided by our center. Below are your account details:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Username</strong><span style="font-weight: 400;">: ' + k8s_account + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Initial Password</strong><span style="font-weight: 400;">: ' + k8s_password + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">To ensure the security of your account, we strongly recommend changing your password immediately upon your first login.</span></p>'\
        '<p><span style="font-weight: 400;">We have also prepared a comprehensive user manual to help you get started with the system. You can download it via the following link:</span></p>'\
        '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI&amp;source=gmail&amp;ust=1746082963524000&amp;usg=AOvVaw06m_RAtCuMh0naKiU9sUYV"> download it via click the link</a></span></p>'\
        '<p><span style="font-weight: 400;">If you have any questions or did not authorize this action, please contact us immediately. We will assist you as soon as possible:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">Wishing you a smooth and successful experience.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body3C = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">您已被加入至本平台中的指定群組，相關資訊如下：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>群組名稱</strong><span style="font-weight: 400;">：' + k8s_group + '&nbsp;</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>加入時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">如您尚未熟悉本平台的群組功能，歡迎參閱我們的使用手冊：</span></p>'\
        '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI&amp;source=gmail&amp;ust=1746082963524000&amp;usg=AOvVaw06m_RAtCuMh0naKiU9sUYV">點擊這裡下載使用手冊</a></span></p>'\
        '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或非本人授權操作，請立即與我們聯繫，我們將盡速為您處理：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">工作順利、使用愉快</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body3E = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">You have been added to a designated group on our platform. The details are as follows:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Group Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Date Joined</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">If you are not yet familiar with the platform&rsquo;s group features, we encourage you to review our user manual:</span><span style="font-weight: 400;"><br /></span><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI"><span style="font-weight: 400;">https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI</span></a></p>'\
        '<p><span style="font-weight: 400;">If you have any questions or did not authorize this action, please contact us immediately. We will assist you promptly:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">Wishing you success and an enjoyable experience.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body3 = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">您已被加入至本平台中的指定群組，相關資訊如下：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>群組名稱</strong><span style="font-weight: 400;">：' + k8s_group + '&nbsp;</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>加入時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">如您尚未熟悉本平台的群組功能，歡迎參閱我們的使用手冊：</span></p>'\
        '<p><span style="font-weight: 400;"><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI" target="_blank" rel="noopener" data-saferedirecturl="https://www.google.com/url?q=https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI&amp;source=gmail&amp;ust=1746082963524000&amp;usg=AOvVaw06m_RAtCuMh0naKiU9sUYV">點擊這裡下載使用手冊</a></span></p>'\
        '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或非本人授權操作，請立即與我們聯繫，我們將盡速為您處理：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">工作順利、使用愉快</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
        '<p>&nbsp;</p>'\
        '<p>--------------------------------------------------------------------------------</p>'\
        '<p>&nbsp;</p>'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">You have been added to a designated group on our platform. The details are as follows:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Group Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Date Joined</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">If you are not yet familiar with the platform&rsquo;s group features, we encourage you to review our user manual:</span><span style="font-weight: 400;"><br /></span><a href="https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI"><span style="font-weight: 400;">https://drive.google.com/drive/u/2/folders/1VbYwBfsxX3XF39TK8bOWix3GxJT-xBNI</span></a></p>'\
        '<p><span style="font-weight: 400;">If you have any questions or did not authorize this action, please contact us immediately. We will assist you promptly:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">Wishing you success and an enjoyable experience.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body4C = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">您已自本平台中的下列群組中移除，相關資訊如下：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>群組名稱</strong><span style="font-weight: 400;">：' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>移除時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或認為可能有誤，請即刻聯繫我們：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">我們將誠摯協助您釐清與處理相關事項。</span></p>'\
        '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">一切順心、平安順利</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body4E = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">You have been removed from the following group on our platform. Details are as follows:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Group Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Removal Date</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">If you believe this action was taken in error or have any concerns, please do not hesitate to contact us:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">We are here to assist you and clarify any issues.</span></p>'\
        '<p><span style="font-weight: 400;">Wishing you all the best and continued success.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body4 = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">您已自本平台中的下列群組中移除，相關資訊如下：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>群組名稱</strong><span style="font-weight: 400;">：' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>移除時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">若您對此操作有任何疑問，或認為可能有誤，請即刻聯繫我們：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">我們將誠摯協助您釐清與處理相關事項。</span></p>'\
        '<p><span style="font-weight: 400;">敬祝</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">一切順心、平安順利</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
        '<p>&nbsp;</p>'\
        '<p>--------------------------------------------------------------------------------</p>'\
        '<p>&nbsp;</p>'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">You have been removed from the following group on our platform. Details are as follows:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Group Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Removal Date</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">If you believe this action was taken in error or have any concerns, please do not hesitate to contact us:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">We are here to assist you and clarify any issues.</span></p>'\
        '<p><span style="font-weight: 400;">Wishing you all the best and continued success.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'


email_body5C = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">本信通知您，您的帳號將在指定時間自本平台系統中</span><strong>正式刪除</strong><span style="font-weight: 400;">，相關資訊如下：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>帳號名稱</strong><span style="font-weight: 400;">：' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>刪除時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">自刪除生效時起，您將無法再登入本平台，並將失去所有原有權限及資料存取權。請留意，帳號一經刪除將</span><strong>無法恢復</strong><span style="font-weight: 400;">，相關個人資料與操作紀錄亦將依據資料保留政策一併處理。</span></p>'\
        '<p><span style="font-weight: 400;">如您認為本次操作有誤，或需進一步協助，歡迎儘速與我們聯繫：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">感謝您過往對本平台的支持與使用，祝您一切順利。</span></p>'\
        '<p><span style="font-weight: 400;">此致</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">敬禮</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body5E = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">This is to inform you that your account will be </span><strong>officially deleted</strong><span style="font-weight: 400;"> from our platform at the specified time. The details are as follows:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Account Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Scheduled Deletion Date</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">Once the deletion takes effect, you will no longer be able to log into the platform, and all existing permissions and data access rights will be revoked.</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">Please note that </span><strong>deleted accounts cannot be restored</strong><span style="font-weight: 400;">, and all related personal data and activity records will be handled in accordance with our data retention policy.</span></p>'\
        '<p><span style="font-weight: 400;">If you believe this action was taken in error, or if you require further assistance, please contact us as soon as possible:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">We sincerely thank you for your past support and use of our platform, and we wish you all the best.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'

email_body5 = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
        '<p><span style="font-weight: 400;">親愛的 ' + k8s_name + ' 您好，</span></p>'\
        '<p><span style="font-weight: 400;">本信通知您，您的帳號將在指定時間自本平台系統中</span><strong>正式刪除</strong><span style="font-weight: 400;">，相關資訊如下：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>帳號名稱</strong><span style="font-weight: 400;">：' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>刪除時間</strong><span style="font-weight: 400;">：' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">自刪除生效時起，您將無法再登入本平台，並將失去所有原有權限及資料存取權。請留意，帳號一經刪除將</span><strong>無法恢復</strong><span style="font-weight: 400;">，相關個人資料與操作紀錄亦將依據資料保留政策一併處理。</span></p>'\
        '<p><span style="font-weight: 400;">如您認為本次操作有誤，或需進一步協助，歡迎儘速與我們聯繫：</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">電話：</span><strong>(03) 211-8800 分機 3001</strong></li>'\
        '<li style="font-weight: 400;" aria-level="1"><span style="font-weight: 400;">信箱：</span><strong>aiplatform@cgu.edu.tw</strong></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">感謝您過往對本平台的支持與使用，祝您一切順利。</span></p>'\
        '<p><span style="font-weight: 400;">此致</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">敬禮</span></p>'\
        '<p><span style="font-weight: 400;">長庚大學人工智慧中心</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'\
        '<p>&nbsp;</p>'\
        '<p>--------------------------------------------------------------------------------</p>'\
        '<p>&nbsp;</p>'\
        '<p><span style="font-weight: 400;">Dear ' + k8s_name + ',</span></p>'\
        '<p><span style="font-weight: 400;">This is to inform you that your account will be </span><strong>officially deleted</strong><span style="font-weight: 400;"> from our platform at the specified time. The details are as follows:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Account Name</strong><span style="font-weight: 400;">: ' + k8s_group + '</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Scheduled Deletion Date</strong><span style="font-weight: 400;">: ' + k8s_date + '</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">Once the deletion takes effect, you will no longer be able to log into the platform, and all existing permissions and data access rights will be revoked.</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">Please note that </span><strong>deleted accounts cannot be restored</strong><span style="font-weight: 400;">, and all related personal data and activity records will be handled in accordance with our data retention policy.</span></p>'\
        '<p><span style="font-weight: 400;">If you believe this action was taken in error, or if you require further assistance, please contact us as soon as possible:</span></p>'\
        '<ul>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Phone</strong><span style="font-weight: 400;">: (03) 211-8800 ext. 3001</span></li>'\
        '<li style="font-weight: 400;" aria-level="1"><strong>Email</strong><span style="font-weight: 400;">: aiplatform@cgu.edu.tw</span></li>'\
        '</ul>'\
        '<p><span style="font-weight: 400;">We sincerely thank you for your past support and use of our platform, and we wish you all the best.</span></p>'\
        '<p><span style="font-weight: 400;">Sincerely,</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">AI Center, Chang Gung University</span><span style="font-weight: 400;"><br /></span><span style="font-weight: 400;">aiplatform@cgu.edu.tw</span></p>'


email_body1 = '<!-- ####### HEY, I AM THE SOURCE EDITOR! #########-->'\
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


# send_email_gmail('帳號啟用通知信', email_body2, "d000018238@cgu.edu.tw")
# send_email_gmail('群組加入通知信', email_body3, "d000018238@cgu.edu.tw")
# send_email_gmail('群組移除通知信', email_body4, "d000018238@cgu.edu.tw")
# send_email_gmail('帳號刪除通知信', email_body5, "d000018238@cgu.edu.tw")
send_email_gmail('帳號啟用通知信 ( Account Activation Notification )', email_body2, "wycca1@gmail.com")
send_email_gmail('群組加入通知信 ( Group Membership Notification )', email_body3, "wycca1@gmail.com")
send_email_gmail('群組移除通知信 ( Group Removal Notification )', email_body4, "wycca1@gmail.com")
send_email_gmail('帳號刪除通知信 ( Account Deletion Notification )', email_body5, "wycca1@gmail.com")