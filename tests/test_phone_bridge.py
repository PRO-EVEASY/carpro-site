"""Do not route a provider request through a different attached phone."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phone_bridge import choose_phone


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


if __name__ == "__main__":
    unittest.main()
