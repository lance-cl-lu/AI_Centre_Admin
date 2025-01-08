POD=backend-deployment-bd94df95f-qk7n6

[ -d frontend/templates/ ] || mkdir frontend/templates/
[ -d frontend/templates/frontend/ ] || mkdir frontend/templates/frontend/
cp -f ../frontend/build/index.html frontend/templates/frontend/
rm -rf static
mkdir static
cp -a ../frontend/build/* static/
rm -f static/index.html

sed -i 's/"\/manifest.json"/"{% static "\/manifest.json" %}"/' frontend/templates/frontend/index.html 
sed -i 's/"\/static\/js\/main./"{% static "\/static\/js\/main./' frontend/templates/frontend/index.html
sed -i 's/.js"/.js" %}"/' frontend/templates/frontend/index.html 
sed -i 's/"\/static\/css\/main./"{% static "\/static\/css\/main./' frontend/templates/frontend/index.html
sed -i 's/.css"/.css" %}"/' frontend/templates/frontend/index.html 

tar czvf static.tgz static

kubectl cp static.tgz -n ldap ${POD}:/
kubectl cp frontend/templates/frontend/index.html -n ldap ${POD}:/
kubectl exec -n ldap ${POD} -- sh -c "cd /;rm -rf /static; tar xzvf static.tgz; rm -rf /code/static; cp -a static /code"
kubectl exec -n ldap ${POD} -- sh -c "cd /;cp -f index.html /code/frontend/templates/frontend/"

exit 0