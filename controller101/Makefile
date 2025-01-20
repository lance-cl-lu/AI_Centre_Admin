run:
	docker build -t cguaicadmin/pod-killer:v0.4 .
	docker push cguaicadmin/pod-killer:v0.4
	kubectl delete -f mycontroll.yaml
	kubectl apply -f mycontroll.yaml
