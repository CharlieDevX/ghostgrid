from fastapi import APIRouter, HTTPException
import docker as docker_sdk

router = APIRouter()


def _get_client():
    try:
        return docker_sdk.from_env()
    except docker_sdk.errors.DockerException as e:
        raise HTTPException(status_code=503, detail=f"Docker unavailable: {e}")


@router.get("/")
def list_containers():
    client = _get_client()
    containers = client.containers.list(all=True)
    result = []
    for c in containers:
        result.append({
            "id": c.short_id,
            "name": c.name,
            "image": c.image.tags[0] if c.image.tags else c.image.short_id,
            "status": c.status,
            "running": c.status == "running",
        })
    return result


@router.post("/{container_name}/start")
def start_container(container_name: str):
    client = _get_client()
    try:
        c = client.containers.get(container_name)
        c.start()
        return {"ok": True, "name": container_name, "status": "started"}
    except docker_sdk.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")


@router.post("/{container_name}/stop")
def stop_container(container_name: str):
    client = _get_client()
    try:
        c = client.containers.get(container_name)
        c.stop()
        return {"ok": True, "name": container_name, "status": "stopped"}
    except docker_sdk.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
