"""Ingress-specific client addresses cannot be chosen through another proxy's header."""
import unittest
from proxy_headers import client_address


class ProxyHeadersTests(unittest.TestCase):
    def test_funnel_ignores_spoofed_cloudflare_header(self):
        self.assertEqual(client_address({'X-Forwarded-For': '192.0.2.8', 'CF-Connecting-IP': '198.51.100.9'},
                                        '127.0.0.1', 'tailscale'), '192.0.2.8')

    def test_cloudflare_ignores_spoofed_forwarded_for(self):
        self.assertEqual(client_address({'CF-Connecting-IP': '192.0.2.8', 'X-Forwarded-For': '198.51.100.9'},
                                        '127.0.0.1'), '192.0.2.8')

    def test_invalid_and_missing_addresses_share_peer_bucket(self):
        for value in ('', 'untrusted', '192.0.2.1, 198.51.100.2', '192.0.2.1\nother'):
            self.assertEqual(client_address({'X-Forwarded-For': value, 'CF-Connecting-IP': '198.51.100.3'},
                                            '127.0.0.1', 'tailscale'), '127.0.0.1')
