kubectl delete deploy backend-deployment -n ldap
kubectl delete service backend-service -n ldap
kubectl delete pvc pvc-backend-sqlite -n ldap
kubectl delete serviceAccount backend-service-account -n ldap
