curl POST /submit (code)
        ↓
FastAPI encodes code + creates Kubernetes Job
        ↓
Kubernetes schedules a Pod → starts container (coderunner:latest)
        ↓
Docker ENTRYPOINT → /usr/local/bin/runner.sh runs automatically
        ↓
runner.sh decodes env vars → writes code → compiles/runs → prints output
        ↓
FastAPI polls Pod logs → returns output → deletes Job/Pod

source venv/bin/activate
minikube image load coderunner:latest
uvicorn main:app --host 127.0.0.1 --port 8000