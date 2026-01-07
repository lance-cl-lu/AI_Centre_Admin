docker:
	./update.sh
	docker build -t cguaicadmin/ldap_backend:v0.2.31 .
	docker push cguaicadmin/ldap_backend:v0.2.31
	kubectl delete deployment backend-deployment -n ldap
	kubectl apply -f full-stack-deployment.yaml

