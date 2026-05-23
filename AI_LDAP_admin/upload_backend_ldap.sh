
POD=backend-deployment-5bd984cd57-fw654

kubectl cp api -n ldap ${POD}:/code

exit 0
