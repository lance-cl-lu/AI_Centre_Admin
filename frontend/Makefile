build:
	docker build -t lms025187/frontend_dev .
	docker push lms025187/frontend_dev
	kubectl delete deployment frontend-deployment
	kubectl apply -f frontend-deployment.yaml