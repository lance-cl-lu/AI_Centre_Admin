
POD=`kubectl get -n ldap pods -l app=backend --no-headers -o custom-columns=":metadata.name"`

[ -d frontend/templates/ ] || mkdir frontend/templates/
[ -d frontend/templates/frontend/ ] || mkdir frontend/templates/frontend/
cp -f ../frontend/build/index.html frontend/templates/frontend/
rm -rf static
mkdir static
cp -a ../frontend/build/* static/
cp -a ../frontend/icons/* static/
rm -f static/index.html

sed -i -E "s#href=\"/logo192\.png\"#href=\"{% static 'logo192.png' %}\"#" frontend/templates/frontend/index.html
sed -i -E "s#href=\"/manifest\.json\"#href=\"{% static 'manifest.json' %}\"#" frontend/templates/frontend/index.html
sed -i -E "s#src=\"/static/js/([^\"]+\.js)\"#src=\"{% static 'static/js/\1' %}\"#" frontend/templates/frontend/index.html
sed -i -E "s#href=\"/static/css/([^\"]+\.css)\"#href=\"{% static 'static/css/\1' %}\"#" frontend/templates/frontend/index.html

tar czvf static.tgz static

kubectl cp static.tgz -n ldap ${POD}:/
kubectl cp frontend/templates/frontend/index.html -n ldap ${POD}:/
kubectl exec -n ldap ${POD} -- sh -c "cd /;rm -rf /static; tar xzvf static.tgz; rm -rf /code/static; cp -a static /code"
kubectl exec -n ldap ${POD} -- sh -c "cd /;cp -f index.html /code/frontend/templates/frontend/"

rm -f static.tgz
# rm -rf static
exit 0
