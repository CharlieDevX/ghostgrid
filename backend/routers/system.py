import psutil
from fastapi import APIRouter

router = APIRouter()


def _cpu_temp() -> float | None:
    try:
        temps = psutil.sensors_temperatures()
        for key in ("coretemp", "cpu_thermal", "k10temp", "acpitz"):
            if key in temps and temps[key]:
                return round(temps[key][0].current, 1)
    except (AttributeError, OSError):
        pass
    return None


@router.get("/")
def get_system_stats():
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    cpu_freq = psutil.cpu_freq()

    def _disk_entry(path, label):
        try:
            d = psutil.disk_usage(path)
            return {
                "label": label,
                "mount": path,
                "total_gb": round(d.total / 1024**3, 1),
                "used_gb": round(d.used / 1024**3, 1),
                "free_gb": round(d.free / 1024**3, 1),
                "percent": d.percent,
            }
        except OSError:
            return None

    disks = [e for e in [
        _disk_entry("/", "System"),
        _disk_entry("/mnt/homelab12tb", "Homelab 12TB"),
    ] if e is not None]

    return {
        "cpu": {
            "percent": psutil.cpu_percent(interval=0.5),
            "count_logical": psutil.cpu_count(logical=True),
            "count_physical": psutil.cpu_count(logical=False),
            "freq_mhz": round(cpu_freq.current, 1) if cpu_freq else None,
            "temp_c": _cpu_temp(),
        },
        "memory": {
            "total_gb": round(vm.total / 1024**3, 2),
            "used_gb": round(vm.used / 1024**3, 2),
            "available_gb": round(vm.available / 1024**3, 2),
            "percent": vm.percent,
        },
        "disk": {
            "total_gb": round(disk.total / 1024**3, 1),
            "used_gb": round(disk.used / 1024**3, 1),
            "free_gb": round(disk.free / 1024**3, 1),
            "percent": disk.percent,
        },
        "disks": disks,
        "uptime_seconds": int(
            psutil.time.time() - psutil.boot_time()
        ),
    }
