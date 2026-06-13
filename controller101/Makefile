run:
	docker build -t cguaicadmin/pod-killer:v0.56 .
	docker push cguaicadmin/pod-killer:v0.56
	kubectl delete -f pod-killer-controll.yaml
	kubectl apply -f pod-killer-controll.yaml
	