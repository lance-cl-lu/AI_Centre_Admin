run:
	docker build -t cguaicadmin/pod-killer:v0.54 .
	docker push cguaicadmin/pod-killer:v0.54
	kubectl delete -f mycontroll.yaml
	kubectl apply -f mycontroll.yaml
