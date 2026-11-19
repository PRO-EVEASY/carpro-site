"""Normalize only the address header supplied by the configured ingress."""
from ipaddress import ip_address


def client_address(headers, peer, ingress="cloudflare"):
    name = "X-Forwarded-For" if ingress == "tailscale" else "CF-Connecting-IP"
    try:
        return str(ip_address(headers.get(name, "").strip()))
    except ValueError:
        # Malformed/absent metadata shares one bucket; never trust an arbitrary
        # client-controlled Cloudflare header on the Tailscale ingress.
        return peer
