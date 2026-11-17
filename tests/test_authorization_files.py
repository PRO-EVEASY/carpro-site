"""Check browser ZIP output using Python's independent ZIP/CRC implementation."""
import base64
import io
import json
from pathlib import Path
import shutil
import subprocess
import unittest
import zipfile

MODULE = Path(__file__).resolve().parents[1] / 'assets/authorization-files.js'
EXPECTED_FLAG = [{'index': 0, 'name': 'PnScreen', 'params': {
    'PartNumber': None, 'IPCScreenType': None, 'IVIScreenType': None, 'action': 'eu_debugmode'}}]


@unittest.skipUnless(shutil.which('node'), 'Node is needed to check browser ZIP output')
class AuthorizationFilesTests(unittest.TestCase):
    def archive(self, key):
        script = "const api=require(process.argv[1]);process.stdout.write(Buffer.from(api.packageFiles(JSON.parse(process.argv[2]))).toString('base64'));"
        result = subprocess.run(['node', '-e', script, str(MODULE), json.dumps(key)], capture_output=True, text=True, check=True)
        return zipfile.ZipFile(io.BytesIO(base64.b64decode(result.stdout)))

    def test_bundle_contains_exactly_the_two_required_files(self):
        with self.archive('SYNTHETIC_AUTHORIZATION_KEY_ONLY') as archive:
            self.assertEqual(archive.namelist(), ['adbauth.key', 'svtasklist.flag'])
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.read('adbauth.key'), b'SYNTHETIC_AUTHORIZATION_KEY_ONLY')
            self.assertEqual(json.loads(archive.read('svtasklist.flag')), EXPECTED_FLAG)
            self.assertFalse(archive.read('svtasklist.flag').startswith(b'\xef\xbb\xbf'))

    def test_key_bytes_preserved_without_added_newlines_or_decoding(self):
        for key in ('  SYNTHETIC\nCODE=\r\n', 'synthetic UTF-8 קוד בדיקה'):
            with self.archive(key) as archive:
                self.assertEqual(archive.read('adbauth.key'), key.encode('utf-8'))
                self.assertIsNone(archive.testzip())

    def test_empty_invalid_and_oversized_keys_cannot_form_a_bundle(self):
        for key in ('', '  ', None, 123, 'x' * 16385):
            with self.assertRaises(subprocess.CalledProcessError): self.archive(key)


if __name__ == '__main__': unittest.main()
