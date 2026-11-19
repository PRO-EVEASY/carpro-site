"""Do not route a provider request through a different attached phone."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phone_bridge import choose_phone, recover_tablet


class PhoneSelectionTests(unittest.TestCase):
    devices = [
        ["test-old-phone", "device", "model:TEST_OLD"],
        ["test-new-phone", "device", "model:TEST_NEW"],
    ]

    def test_saved_phone_selected_with_two_phones_connected(self):
        self.assertEqual(choose_phone(self.devices, {"serial": "test-new-phone"}),
                         ("test-new-phone", "TEST_NEW"))

    def test_disconnected_saved_phone_never_falls_back_to_another(self):
        with self.assertRaises(SystemExit):
            choose_phone(self.devices[:1], {"serial": "test-new-phone"})

    def test_explicit_model_selects_the_new_phone(self):
        self.assertEqual(choose_phone(self.devices, {"serial": "test-old-phone"}, "TEST_NEW"),
                         ("test-new-phone", "TEST_NEW"))

    def test_ambiguous_or_unauthorized_phones_are_not_selected(self):
        with self.assertRaises(SystemExit):
            choose_phone(self.devices, {})
        with self.assertRaises(SystemExit):
            choose_phone([["test-new-phone", "unauthorized", "model:TEST_NEW"]], {}, "TEST_NEW")

    def test_single_phone_can_be_selected_initially(self):
        self.assertEqual(choose_phone(self.devices[1:], {}), ("test-new-phone", "TEST_NEW"))


class TabletRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.config = {'endpoint': '192.0.2.10:5555', 'device_serial': 'test-tablet', 'model': 'TEST_TABLET'}

    def test_ready_wireless_transport_requires_matching_physical_identity(self):
        devices = [['192.0.2.10:5555', 'device', 'model:TEST_TABLET']]
        with patch('phone_bridge.adb', return_value='test-tablet'):
            self.assertEqual(recover_tablet(devices, self.config), ('192.0.2.10:5555', 'TEST_TABLET'))
        with patch('phone_bridge.adb', return_value='different-phone'), self.assertRaises(SystemExit):
            recover_tablet(devices, self.config)

    def test_usb_fallback_survives_wireless_connection_failure(self):
        devices = [['test-tablet', 'device', 'model:TEST_TABLET'], ['other-phone', 'device', 'model:TEST_OTHER']]
        def fake(*args):
            if args == ('-s', 'test-tablet', 'shell', 'ip', '-4', 'addr', 'show', 'wlan0'):
                return 'inet 192.0.2.44/24'
            if args == ('connect', '192.0.2.44:5555'):
                raise SystemExit('wireless unavailable')
            if args == ('-s', 'test-tablet', 'shell', 'getprop', 'ro.serialno'):
                return 'test-tablet'
            self.fail('Unexpected device operation')
        with patch('phone_bridge.adb', side_effect=fake):
            self.assertEqual(recover_tablet(devices, self.config), ('test-tablet', 'TEST_TABLET'))
        self.assertEqual(self.config['endpoint'], '192.0.2.44:5555')

    def test_missing_tablet_never_falls_back_to_another_phone(self):
        devices = [['other-phone', 'device', 'model:TEST_OTHER']]
        with patch('phone_bridge.adb', side_effect=['failed', 'List of devices attached\nother-phone device model:TEST_OTHER']), self.assertRaises(SystemExit):
            recover_tablet(devices, self.config)

    def test_disconnected_tablet_is_reconnected_before_selection(self):
        with patch('phone_bridge.adb', side_effect=['connected',
                'List of devices attached\n192.0.2.10:5555 device model:TEST_TABLET', 'test-tablet']) as command:
            self.assertEqual(recover_tablet([], self.config), ('192.0.2.10:5555', 'TEST_TABLET'))
            self.assertEqual(command.call_args_list[0].args, ('connect', '192.0.2.10:5555'))


if __name__ == "__main__":
    unittest.main()
