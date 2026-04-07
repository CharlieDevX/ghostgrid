import time
import psutil
from fastapi import APIRouter

router = APIRouter()

# Interfaces to show (skip docker bridges, veth, loopback)
TRACKED = ("enp4s0", "tailscale0")

_last: dict[str, tuple[float, int, int]] = {}  # iface -> (timestamp, bytes_sent, bytes_recv)


def _speed(iface: str, sent: int, recv: int) -> tuple[float, float]:
    """Return (tx_kbps, rx_kbps) since last call, or 0 on first call."""
    now = time.monotonic()
    if iface in _last:
        t0, s0, r0 = _last[iface]
        dt = now - t0 or 0.001
        tx = (sent - s0) / dt / 1024
        rx = (recv - r0) / dt / 1024
    else:
        tx = rx = 0.0
    _last[iface] = (now, sent, recv)
    return round(tx, 1), round(rx, 1)


def _fmt_ip(addrs, family="AF_INET") -> str | None:
    for a in addrs:
        if a.family.name == family and not a.address.startswith("fe80"):
            return a.address
    return None


@router.get("/")
def get_network():
    counters = psutil.net_io_counters(pernic=True)
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()

    interfaces = []
    for iface in TRACKED:
        c = counters.get(iface)
        if not c:
            continue
        tx_kbps, rx_kbps = _speed(iface, c.bytes_sent, c.bytes_recv)
        st = stats.get(iface)
        iface_addrs = addrs.get(iface, [])
        interfaces.append({
            "name": iface,
            "up": st.isup if st else False,
            "ip4": _fmt_ip(iface_addrs, "AF_INET"),
            "ip6": _fmt_ip(iface_addrs, "AF_INET6"),
            "tx_kbps": tx_kbps,
            "rx_kbps": rx_kbps,
            "bytes_sent": c.bytes_sent,
            "bytes_recv": c.bytes_recv,
        })

    # Tailscale-specific: grab the 100.x IP cleanly
    ts_addrs = addrs.get("tailscale0", [])
    tailscale_ip = next(
        (a.address for a in ts_addrs if a.address.startswith("100.")), None
    )

    return {
        "interfaces": interfaces,
        "tailscale_ip": tailscale_ip,
    }
