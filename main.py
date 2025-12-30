from fastapi import FastAPI, HTTPException
import datetime
from pydantic import BaseModel
import base64, uuid, time, os, json
from kubernetes import client, config
from supabase import create_client, Client
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# --- Config ---
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") 

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ CONFIG ERROR: Missing Supabase Credentials.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    config.load_kube_config()
    batch_v1 = client.BatchV1Api()
    core_v1 = client.CoreV1Api()
except Exception:
    print("⚠️ KUBERNETES ERROR: Config not loaded.")

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

class SubmissionRequest(BaseModel):
    student_id: str
    question_id: str
    language: str
    code: str

class RunRequest(BaseModel):
    language: str
    code: str
    custom_input: str

# Helper to execute Job
def execute_k8s_job(job_id, language, code_b64, inputs_b64, expected_b64, mode="submit"):
    container = client.V1Container(
        name="coderunner",
        image="coderunner:latest",
        image_pull_policy="Never",
        env=[
            client.V1EnvVar(name="LANGUAGE", value=language),
            client.V1EnvVar(name="CODE_B64", value=code_b64),
            client.V1EnvVar(name="INPUTS_B64", value=inputs_b64),
            client.V1EnvVar(name="EXPECTED_B64", value=expected_b64),
            client.V1EnvVar(name="EXECUTION_MODE", value=mode)
        ],
        resources=client.V1ResourceRequirements(limits={"memory": "256Mi", "cpu": "500m"}),
        volume_mounts=[client.V1VolumeMount(name="vol", mount_path="/submission")]
    )
    volume = client.V1Volume(name="vol", empty_dir=client.V1EmptyDirVolumeSource())
    job = client.V1Job(
        metadata=client.V1ObjectMeta(name=job_id),
        spec=client.V1JobSpec(
            template=client.V1PodTemplateSpec(spec=client.V1PodSpec(restart_policy="Never", containers=[container], volumes=[volume])),
            backoff_limit=0, ttl_seconds_after_finished=60
        )
    )
    batch_v1.create_namespaced_job("default", job)

    # Poll
    for _ in range(25):
        time.sleep(1)
        try:
            pods = core_v1.list_namespaced_pod("default", label_selector=f"job-name={job_id}").items
        except: continue
        
        if pods and pods[0].status.phase in ["Succeeded", "Failed"]:
            try:
                logs = core_v1.read_namespaced_pod_log(pods[0].metadata.name, "default")
                if "###JSON_START###" in logs:
                    json_str = logs.split("###JSON_START###")[1].split("###JSON_END###")[0]
                    results = json.loads(json_str)
                    
                    try: batch_v1.delete_namespaced_job(job_id, "default", body=client.V1DeleteOptions(propagation_policy='Foreground'))
                    except: pass
                    
                    return results
            except Exception as e:
                print(f"Log Parsing Error: {e}")
            break
    
    # Cleanup if timeout
    try: batch_v1.delete_namespaced_job(job_id, "default", body=client.V1DeleteOptions(propagation_policy='Foreground'))
    except: pass
    return None

@app.post("/run")
def run_custom(req: RunRequest):
    job_id = f"run-{uuid.uuid4().hex[:8]}"
    
    code_b64 = base64.b64encode(req.code.encode()).decode()
    inputs_b64 = base64.b64encode(req.custom_input.encode()).decode()
    
    results = execute_k8s_job(job_id, req.language, code_b64, inputs_b64, "", mode="run")
    
    if not results:
        raise HTTPException(status_code=500, detail="Execution timed out or failed")
    
    # Decode Output
    result = results[0]
    output_decoded = ""
    try:
        output_decoded = base64.b64decode(result.get("output_b64", "")).decode('utf-8', errors='ignore')
    except: pass
    
    return {
        "status": result.get("status"),
        "output": output_decoded,
        "time": result.get("time"),
        "error": result.get("error") # For compilation errors
    }

@app.post("/submit")
def submit_code(sub: SubmissionRequest):
    job_id = f"sub-{uuid.uuid4().hex[:8]}"
    
    # 1. Fetch Test Cases
    try:
        tc_query = supabase.table("test_cases").select("*").eq("question_id", sub.question_id).execute()
        test_cases = tc_query.data
        if not test_cases: raise HTTPException(status_code=404, detail="No test cases found.")

        full_inputs = []
        full_outputs = []
        for tc in test_cases:
            try:
                in_bytes = supabase.storage.from_("lab-files").download(tc['input_file_path'])
                out_bytes = supabase.storage.from_("lab-files").download(tc['output_file_path'])
                full_inputs.append(in_bytes.decode('utf-8').strip())
                full_outputs.append(out_bytes.decode('utf-8').strip())
            except Exception:
                continue
            
        delimiter = "\n---\n"
        inputs_b64 = base64.b64encode(delimiter.join(full_inputs).encode()).decode()
        expected_b64 = base64.b64encode(delimiter.join(full_outputs).encode()).decode()
        code_b64 = base64.b64encode(sub.code.encode()).decode()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prep Error: {str(e)}")

    # 2. Run Job
    results_json = execute_k8s_job(job_id, sub.language, code_b64, inputs_b64, expected_b64, mode="submit")
    
    if not results_json:
        # Fallback if job failed silently
        return {"status": "error", "results": [], "error": "Execution Environment Error"}

    final_status = "completed"

    # 3. Save to Database
    try:
        total_passed = sum(1 for r in results_json if r.get('status') == 'Passed')
        total_score = 10 * total_passed
        max_score = 10 * len(results_json) if results_json else 0

        sub_resp = supabase.table("submissions").insert({
            "student_id": str(sub.student_id),
            "question_id": str(sub.question_id),
            "code": str(sub.code),
            "language": str(sub.language),
            "status": str(final_status),
            "total_score": int(total_score),
            "max_score": int(max_score)
        }).execute()

        if sub_resp.data:
            submission_id = sub_resp.data[0]['id']
            tc_inserts = []
            
            for i, res in enumerate(results_json):
                original_tc_id = test_cases[i]['id'] if i < len(test_cases) else None
                is_hidden = test_cases[i]['is_hidden'] if i < len(test_cases) else False
                
                try:
                    std_out = base64.b64decode(res.get("output_b64", "")).decode('utf-8', errors='ignore')
                    exp_out = base64.b64decode(res.get("expected_b64", "")).decode('utf-8', errors='ignore')
                except:
                    std_out = ""
                    exp_out = ""

                tc_inserts.append({
                    "submission_id": str(submission_id),
                    "test_case_id": str(original_tc_id) if original_tc_id else None,
                    "status": str(res.get("status", "Unknown")),
                    "execution_time": float(res.get("time", 0.0)),
                    "student_output": str(std_out),
                    "expected_output": str(exp_out),
                    "is_hidden": bool(is_hidden),
                    "points_earned": 10 if res.get("status") == "Passed" else 0
                })
            
            if tc_inserts:
                supabase.table("test_case_results").insert(tc_inserts).execute()
                
            new_status = "In Progress"
            if total_passed == len(results_json) and len(results_json) > 0:
                new_status = "Completed"
            
            supabase.table("student_progress").upsert({
                "student_id": sub.student_id,
                "question_id": sub.question_id,
                "status": new_status,
                "last_accessed": datetime.datetime.now().isoformat()
            }, on_conflict="student_id, question_id").execute()

            return {"status": final_status, "results": tc_inserts, "score": f"{total_score}/{max_score}"}
            
    except Exception as db_err:
        print(f"DB Save Error: {db_err}")
        return {"status": final_status, "results": results_json, "error": "History save failed."}