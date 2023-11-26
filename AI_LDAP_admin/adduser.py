#/usr/bin/python
import os,subprocess
from passlib.hash import bcrypt 
import getpass

EMAIL=input('Email:')
USERNAME=input("User Name:")
USERID=subprocess.check_output(['cat','/proc/sys/kernel/random/uuid']).decode('utf8')
HASH=bcrypt.using(rounds=12, ident="2y").hash(getpass.getpass())

config=subprocess.check_output(['kubectl', 'get', 'configmap','dex','-n', 'auth','-o', "jsonpath='{.data.config\.yaml}'"]).decode('utf8')[1:-1]

r=[]
for l in config.split('\n'):
    if l.startswith('staticPasswords:'):
        r.append('staticPasswords:')
        r.append('- email: '+EMAIL)
        r.append('  hash: '+HASH)
        r.append('  username: '+USERNAME)
        r.append('  userID: '+USERID)
    else:
        r.append(l)

f=open('dex-config.yaml','w')
f.write('\n'.join(r))
f.close()
os.system('kubectl create configmap dex --from-file=config.yaml=dex-config.yaml -n auth --dry-run -oyaml | kubectl apply -f -')
os.system('kubectl rollout restart deployment dex -n auth')
f=open('dex-profile.yaml','w')
f.write('apiVersion: kubeflow.org/v1beta1\n')
f.write('kind: Profile\n')
f.write('metadata:\n')
f.write('  name: '+USERNAME+'\n')
f.write('spec:\n')
f.write('  owner:\n')
f.write('    kind: User\n')
f.write('    name: '+ EMAIL+'\n')
f.close()
os.system('kubectl apply -f dex-profile.yaml')
