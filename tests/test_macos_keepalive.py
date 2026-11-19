"""Recovery never replaces another mount or interrupts a fresh issuance."""
import unittest
from macos_keepalive import check_config, ensure_vpn, should_restart_backend


class KeepaliveTests(unittest.TestCase):
    def test_only_the_configured_disconnected_vpn_is_restarted(self):
        commands = []
        results = iter(['Disconnected\n', '', 'Connected\n'])
        def runner(args):
            commands.append(args)
            return next(results)
        self.assertTrue(ensure_vpn('synthetic-service-id', runner))
        self.assertEqual(commands, [
            ['/usr/sbin/scutil', '--nc', 'status', 'synthetic-service-id'],
            ['/usr/sbin/scutil', '--nc', 'start', 'synthetic-service-id'],
            ['/usr/sbin/scutil', '--nc', 'status', 'synthetic-service-id'],
        ])
        self.assertTrue(ensure_vpn('synthetic-service-id', lambda args: 'Connected\n'))

    def test_pending_issuance_and_restart_cooldown_are_respected(self):
        self.assertFalse(should_restart_backend(1, 0, False, 100))
        self.assertFalse(should_restart_backend(2, 0, True, 100))
        self.assertFalse(should_restart_backend(2, 70, False, 100))
        self.assertTrue(should_restart_backend(2, 0, False, 100))

    def test_native_proxy_cannot_be_redirected_to_an_external_host(self):
        check_config({'proxy_url': 'http://127.0.0.1:12345', 'origin': 'https://test.tail-example.ts.net'})
        with self.assertRaises(RuntimeError):
            check_config({'proxy_url': 'http://192.0.2.1:12345', 'origin': 'https://test.tail-example.ts.net'})
