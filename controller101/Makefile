run:
	docker build -t cguaicadmin/pod-killer:v0.5 .
	docker push cguaicadmin/pod-killer:v0.5
	kubectl delete -f mycontroll.yaml
	kubectl apply -f mycontroll.yaml
