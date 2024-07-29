docker:
	./update.sh
	docker build -t cguaicadmin/backend_dev:v0.3 .
	docker push cguaicadmin/backend_dev:v0.3
	kubectl delete deployment backend-deployment -n ldap
	kubectl apply -f full-stack-deployment.yaml