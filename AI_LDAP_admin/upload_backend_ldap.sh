
POD=backend-deployment-67d86d9fb8-ss7m7

kubectl cp api -n ldap ${POD}:/code

exit 0
