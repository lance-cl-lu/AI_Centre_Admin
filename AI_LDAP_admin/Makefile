docker:
	./update.sh
	docker build -t cguaicadmin/ldap_backend:v0.2.31 .
	docker push cguaicadmin/ldap_backend:v0.2.31
	kubectl apply -f cluster-role.yaml
	kubectl apply -f cluster-role-binding.yaml
	kubectl apply -f announcement-configmap-rbac.yaml
	kubectl delete deployment backend-deployment -n ldap
	kubectl apply -f full-stack-deployment.yaml

