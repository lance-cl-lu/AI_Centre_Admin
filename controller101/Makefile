run:
	docker build -t cguaicadmin/pod-killer:v0.1 .
	docker push cguaicadmin/pod-killer:v0.1
	kubectl delete -f mycontroll.yaml
	kubectl apply -f mycontroll.yaml