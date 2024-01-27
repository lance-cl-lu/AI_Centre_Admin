docker:
	./update.sh
	docker build -t lms025187/backend_dev:v0.2 .
	docker push lms025187/backend_dev:v0.2
	kubectl delete deploy backend-deployment -n ldap
	kubectl apply -f full-stack-deployment.yaml
