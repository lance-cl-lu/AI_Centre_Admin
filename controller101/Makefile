run:
	docker build -t cguaicadmin/pod-killer:v0.52 .
	docker push cguaicadmin/pod-killer:v0.52
	kubectl delete -f mycontroll.yaml
	kubectl apply -f mycontroll.yaml
