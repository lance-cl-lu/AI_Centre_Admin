docker:
	./update.sh
	docker build -t cguaicadmin/backend_dev:v0.2 .
	docker push cguaicadmin/backend_dev:v0.2
	kubectl delete deployment backend-deployment -n ldap
	kubectl apply -f full-stack-deployment.yaml