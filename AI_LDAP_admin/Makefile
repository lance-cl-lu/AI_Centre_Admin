docker:
	docker build -t lms025187/backend_dev .
	docker push lms025187/backend_dev
build:
	./update.sh
	docker build -t lms025187/backend_dev .
	docker push lms025187/backend_dev
	kubectl delete deployment backend-deployment
	kubectl apply -f backend-deployment.yaml