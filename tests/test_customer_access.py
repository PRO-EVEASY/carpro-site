"""Security and accounting checks use synthetic customers and a fake provider."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from customer_access import AccessError, CustomerAccess, SESSION_SECONDS, totp


def secret_from(customer):
    return parse_qs(urlsplit(customer['setupUri']).query)['secret'][0]


class CustomerAccessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.now = 1700000000
        self.store = CustomerAccess(Path(self.temp.name) / 'private/customers.sqlite', lambda: self.now)
        self.client = self.store.provision('Synthetic customer', 2)
        self.secret = secret_from(self.client)

    def tearDown(self):
        self.temp.cleanup()

    def login(self):
        return self.store.login(self.client['id'], totp(self.secret, self.now // 30), 'test-address')[0]

    def test_totp_matches_rfc_6238_sha1_vectors(self):
        secret = base64.b32encode(b'12345678901234567890').decode()
        for timestamp, expected in [(59, '94287082'), (1111111109, '07081804'),
                                    (1111111111, '14050471'), (1234567890, '89005924'),
                                    (2000000000, '69279037'), (20000000000, '65353130')]:
            self.assertEqual(totp(secret, timestamp // 30, 8), expected)

    def test_valid_code_is_single_use_and_next_code_works(self):
        token = self.login()
        self.assertEqual(self.store.authenticate(token)['id'], self.client['id'])
        with self.assertRaises(AccessError): self.login()
        self.now += 30
        newer = self.login()
        self.assertIsNone(self.store.authenticate(token))
        self.assertIsNotNone(self.store.authenticate(newer))

    def test_wrong_and_expired_codes_rejected(self):
        valid = {totp(self.secret, self.now // 30 + n) for n in (-1, 0, 1)}
        wrong = next(str(n).zfill(6) for n in range(100) if str(n).zfill(6) not in valid)
        for code in (wrong, '12345', '<html>', totp(self.secret, self.now // 30 - 2)):
            with self.assertRaises(AccessError): self.store.login(self.client['id'], code, 'test-address')

    def test_login_rate_limit_and_recovery(self):
        for _ in range(10):
            with self.assertRaises(AccessError): self.store.login('missing', 'bad-code', 'test-address')
        with self.assertRaises(AccessError) as error: self.login()
        self.assertEqual(error.exception.status, 429)
        self.now += 601
        self.assertIsNotNone(self.store.authenticate(self.login()))

    def test_one_concurrent_login_can_consume_a_code(self):
        def attempt(_):
            try: self.login(); return True
            except AccessError: return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(attempt, range(2))), 1)

    def test_sessions_expire_and_logout_revokes(self):
        token = self.login()
        self.store.logout(token)
        self.assertIsNone(self.store.authenticate(token))
        self.now += 30
        token = self.login()
        self.now += SESSION_SECONDS + 1
        self.assertIsNone(self.store.authenticate(token))

    def test_reset_invalidates_previous_authenticator_and_session(self):
        token = self.login()
        renewed = self.store.provision(customer_id=self.client['id'])
        self.assertNotEqual(secret_from(renewed), self.secret)
        self.assertIsNone(self.store.authenticate(token))
        self.now += 30
        with self.assertRaises(AccessError): self.login()

    def test_disabled_customer_cannot_log_in_or_keep_session(self):
        token = self.login()
        self.store.update(self.client['id'], 'disable')
        self.assertIsNone(self.store.authenticate(token))
        self.now += 30
        with self.assertRaises(AccessError): self.login()
        self.store.update(self.client['id'], 'enable')
        self.assertIsNotNone(self.store.authenticate(self.login()))

    def test_no_secrets_in_customer_list_or_authenticated_view(self):
        token = self.login()
        for result in (self.store.list_customers(), self.store.authenticate(token)):
            rendered = json.dumps(result)
            self.assertNotIn(self.secret, rendered)
            self.assertNotIn(token, rendered)
            self.assertNotIn('setupUri', rendered)
        self.assertEqual(self.store.path.stat().st_mode & 0o777, 0o600)

    def test_quota_cannot_be_overspent_by_parallel_requests(self):
        def reserve(number):
            try: self.store.reserve(self.client['id'], str(10000000 + number), '20261117'); return True
            except AccessError: return False
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(sum(pool.map(reserve, range(10))), 2)
        self.assertEqual(self.store.customer(self.client['id'])['remainingKeys'], 0)

    def test_retry_reuses_completed_key_without_spending_again(self):
        issue = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store.finish(issue['issue_id'], key_text='synthetic-result-only')
        again = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.assertEqual(again, {'cached': 'synthetic-result-only'})
        self.assertEqual(self.store.customer(self.client['id'])['remainingKeys'], 1)

    def test_uncertain_request_is_not_reissued_automatically(self):
        issue = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store.finish(issue['issue_id'])
        with self.assertRaises(AccessError) as error:
            self.store.reserve(self.client['id'], '12345678', '20261117')
        self.assertEqual(error.exception.code, 'request_needs_review')
        self.assertEqual(self.store.customer(self.client['id'])['remainingKeys'], 1)

    def test_known_failure_releases_reservation(self):
        issue = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store.finish(issue['issue_id'], certain_failure=True)
        self.assertEqual(self.store.customer(self.client['id'])['remainingKeys'], 2)
        self.assertIn('issue_id', self.store.reserve(self.client['id'], '12345678', '20261117'))

    def test_review_release_restores_quota_only_once(self):
        issue = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store.finish(issue['issue_id'])
        self.store.release_uncertain(issue['issue_id'])
        self.assertEqual(self.store.customer(self.client['id'])['remainingKeys'], 2)
        with self.assertRaises(AccessError): self.store.release_uncertain(issue['issue_id'])

    def test_completed_keys_cannot_be_released_as_uncertain(self):
        issue = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store.finish(issue['issue_id'], key_text='synthetic-key-only')
        with self.assertRaises(AccessError): self.store.release_uncertain(issue['issue_id'])
        self.assertEqual(self.store.customer(self.client['id'])['remainingKeys'], 1)

    def test_crashed_pending_request_becomes_uncertain(self):
        self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store = CustomerAccess(self.store.path, lambda: self.now)
        self.assertEqual(len(self.store.list_customers()['uncertainRequests']), 1)

    def test_other_customer_cannot_retrieve_a_key(self):
        issue = self.store.reserve(self.client['id'], '12345678', '20261117')
        self.store.finish(issue['issue_id'], key_text='synthetic-private-result')
        other = self.store.provision('Another synthetic customer', 1)
        self.assertNotIn('cached', self.store.reserve(other['id'], '12345678', '20261117'))
        self.assertEqual(self.store.keys(other['id']), [])
        self.assertEqual(self.store.keys(self.client['id'])[0]['authorizationCode'], 'synthetic-private-result')


class CustomerHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        directory = Path(cls.temp.name)
        cls.count = directory / 'fake-curl-calls'
        curl = directory / 'curl'
        curl.write_text("#!/bin/sh\nprintf x >> \"${0%/*}/fake-curl-calls\"\nprintf '%s\\n' '{\"data\":\"SYNTHETIC_TEST_CODE_ONLY\",\"num\":999,\"debugUrl\":\"https://provider.example.invalid/private\",\"account\":\"synthetic-user\"}' '--CP-HTTP:200'\n")
        curl.chmod(0o700)
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0)); cls.port = s.getsockname()[1]
        cls.auth = 'Basic ' + base64.b64encode(b'test-admin:synthetic-test-admin-password').decode()
        env = {'PATH': str(directory) + os.pathsep + os.defpath,
               'PREVIEW_LOGIN_USER': 'test-admin', 'PREVIEW_LOGIN_PASSWORD': 'synthetic-test-admin-password',
               'ADBAUTH_PROVIDER_URL': 'https://provider.example.invalid/issue', 'ADBAUTH_USERNAME': 'synthetic-user',
               'ADBAUTH_ENABLE_ISSUE': '1', 'ADBAUTH_CUSTOMER_DB': str(directory / 'private/customers.sqlite'),
               'PORT': str(cls.port), 'PYTHONDONTWRITEBYTECODE': '1'}
        cls.server = subprocess.Popen([sys.executable, str(ROOT / 'adb_studio_server.py')], env=env,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        for _ in range(50):
            if cls.server.poll() is not None: raise RuntimeError(cls.server.stderr.read())
            try:
                with socket.create_connection(('127.0.0.1', cls.port), timeout=.1): return
            except OSError: time.sleep(.05)
        raise RuntimeError('Test server did not start')

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate(); cls.server.wait(timeout=5); cls.server.stderr.close(); cls.temp.cleanup()

    def request(self, path, data=None, admin=False, cookie=None, action=None, content_type='application/json', extra_headers=None):
        headers = {}
        if admin: headers['Authorization'] = self.auth
        if cookie: headers['Cookie'] = cookie
        if data is not None:
            headers.update({'Content-Type': content_type, 'X-Forwarded-Proto': 'https'})
            if action is not False:
                headers['X-CockpitPro-Action'] = action or 'manage-customers'
        headers.update(extra_headers or {})
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        try:
            c.request('POST' if data is not None else 'GET', path, body=json.dumps(data) if data is not None else None, headers=headers)
            r = c.getresponse(); return r.status, dict(r.getheaders()), r.read()
        finally: c.close()

    def provision_and_login(self, quota=2):
        status, _, body = self.request('/api/admin/customers', {'action': 'create', 'name': 'Synthetic HTTP customer', 'quota': quota}, admin=True)
        self.assertEqual(status, 200); customer = json.loads(body)
        status, headers, _ = self.request('/api/login', {'customerId': customer['id'], 'code': totp(secret_from(customer), int(time.time()) // 30)}, action='customer-login')
        self.assertEqual(status, 200)
        return customer, headers['Set-Cookie'].split(';')[0], headers['Set-Cookie']

    def test_public_login_and_anonymous_api_boundaries(self):
        status, headers, _ = self.request('/')
        self.assertEqual((status, headers.get('Location')), (302, '/login'))
        self.assertEqual(self.request('/login')[0], 200)
        self.assertEqual(self.request('/api/status')[0], 401)
        self.assertEqual(self.request('/api/generate', {}, action='generate-key')[0], 401)
        self.assertEqual(self.request('/admin')[0], 401)

    def test_cookie_flags_customer_isolation_and_admin_boundaries(self):
        customer, cookie, flags = self.provision_and_login()
        for flag in ('HttpOnly', 'SameSite=Strict', 'Secure'): self.assertIn(flag, flags)
        status, _, body = self.request('/api/status', cookie=cookie)
        self.assertEqual(status, 200); data = json.loads(body)
        self.assertEqual(data['customer']['id'], customer['id']); self.assertNotIn('admin', data)
        self.assertNotIn('secret', body.decode()); self.assertNotIn('setupUri', body.decode())
        self.assertNotIn('providerConfigured', data); self.assertNotIn('proxyConfigured', data)
        self.assertNotIn('provider.example.invalid', body.decode()); self.assertNotIn('synthetic-user', body.decode())
        self.assertEqual(self.request('/api/admin/customers', cookie=cookie)[0], 401)
        self.assertEqual(self.request('/api/admin/customers', {'action': 'create', 'name': 'not allowed', 'quota': 1}, cookie=cookie)[0], 401)
        self.assertEqual(self.request('/admin', cookie=cookie)[0], 401)
        self.request('/api/logout', {}, cookie=cookie, action='customer-logout')
        self.assertEqual(self.request('/api/status', cookie=cookie)[0], 401)

    def test_customer_quota_and_cached_key_without_vendor_calls(self):
        _, cookie, _ = self.provision_and_login(quota=1)
        request = {'serial': '12345678', 'date': '20261117', 'intent': 'generate-key'}
        status, _, body = self.request('/api/generate', request, cookie=cookie, action=False)
        self.assertEqual(status, 200); result = json.loads(body)
        self.assertEqual(result['authorizationCode'], 'SYNTHETIC_TEST_CODE_ONLY')
        self.assertEqual(result['remainingUses'], 0)
        self.assertEqual(set(result), {'ok', 'authorizationCode', 'remainingUses', 'filename'})
        self.assertNotIn('provider.example.invalid', body.decode()); self.assertNotIn('synthetic-user', body.decode())
        status, _, history = self.request('/api/my-keys', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(history)['keys'][0]['authorizationCode'], result['authorizationCode'])
        _, other_cookie, _ = self.provision_and_login()
        self.assertEqual(json.loads(self.request('/api/my-keys?customerId=someone-else', cookie=other_cookie)[2])['keys'], [])
        first_calls = self.count.read_text()
        status, _, body = self.request('/api/generate', request, cookie=cookie, action='generate-key')
        self.assertEqual(status, 200); self.assertEqual(json.loads(body)['authorizationCode'], result['authorizationCode'])
        self.assertEqual(self.count.read_text(), first_calls)
        status, _, body = self.request('/api/generate', {**request, 'serial': '87654321'}, cookie=cookie, action='generate-key')
        self.assertEqual(status, 403); self.assertEqual(json.loads(body)['error'], 'customer_no_remaining_keys')
        self.assertEqual(self.count.read_text(), first_calls)

    def test_json_login_intent_works_when_forwarder_strips_custom_header(self):
        status, _, body = self.request('/api/admin/customers', {'action': 'create', 'name': 'Intent test', 'quota': 1}, admin=True)
        customer = json.loads(body)
        data = {'customerId': customer['id'], 'code': totp(secret_from(customer), int(time.time()) // 30), 'intent': 'customer-login'}
        self.assertEqual(self.request('/api/login', data, action=False)[0], 200)

    def test_login_intent_does_not_allow_cross_site_form_content_types(self):
        for content_type in ('text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'):
            self.assertEqual(self.request('/api/login', {'intent': 'customer-login'}, action=False, content_type=content_type)[0], 415)
        self.assertEqual(self.request('/api/login', {}, action=False)[0], 403)

    def test_customer_server_refuses_cross_origin_preflight(self):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        try:
            c.request('OPTIONS', '/api/login', headers={'Origin': 'https://untrusted.example.invalid', 'Access-Control-Request-Headers': 'content-type'})
            response = c.getresponse()
            self.assertEqual(response.status, 405)
            self.assertIsNone(response.getheader('Access-Control-Allow-Origin'))
            response.read()
        finally: c.close()

    def test_key_download_history_requires_a_customer_session(self):
        self.assertEqual(self.request('/api/my-keys')[0], 401)
        self.assertEqual(self.request('/api/my-keys', admin=True)[0], 403)

    def test_browser_policy_limits_connections_and_allows_each_bundled_script(self):
        for path in ('/login', '/', '/admin'):
            with self.subTest(path=path):
                status, headers, body = self.request(path, admin=True, extra_headers={'X-Forwarded-Proto': 'https'})
                self.assertEqual(status, 200)
                policy = dict(part.strip().split(' ', 1) for part in headers['Content-Security-Policy'].split(';'))
                for directive, expected in [('connect-src', "'self'"), ('form-action', "'self'"),
                                            ('object-src', "'none'"), ('base-uri', "'none'"),
                                            ('frame-ancestors', "'none'"), ('script-src-attr', "'none'")]:
                    self.assertEqual(policy[directive], expected)
                self.assertNotIn("'unsafe-inline'", policy['script-src'])
                self.assertNotIn("'unsafe-eval'", policy['script-src'])
                sources = re.findall(rb'<script\b([^>]*)>(.*?)</script\s*>', body, re.I | re.S)
                self.assertTrue(sources)
                for attrs, source in sources:
                    if not re.search(rb'\bsrc\s*=', attrs, re.I):
                        digest = base64.b64encode(hashlib.sha256(source).digest()).decode()
                        self.assertIn("'sha256-" + digest + "'", policy['script-src'])
                self.assertEqual(headers['Strict-Transport-Security'], 'max-age=31536000')
                self.assertEqual(headers['Referrer-Policy'], 'no-referrer')
                self.assertNotIn('Python', headers['Server'])

    def test_public_http_cannot_log_in_or_issue_even_with_valid_session(self):
        customer, cookie, _ = self.provision_and_login()
        before = self.count.read_bytes() if self.count.exists() else b''
        for path, data in [('/login', None), ('/api/login', {'intent': 'customer-login'}),
                           ('/api/generate', {'serial': '12345678', 'date': '20261117', 'intent': 'generate-key'})]:
            with self.subTest(path=path):
                status, headers, body = self.request(path, data, cookie=cookie, action=False,
                    extra_headers={'X-Forwarded-Proto': 'http'})
                self.assertEqual(status, 400)
                self.assertEqual(json.loads(body), {'error': 'https_required'})
                self.assertNotIn('Set-Cookie', headers)
        self.assertEqual(self.count.read_bytes() if self.count.exists() else b'', before)
        status, _, body = self.request('/api/status', cookie=cookie)
        self.assertEqual(json.loads(body)['customer']['remainingKeys'], customer['quota'])

    def test_missing_transport_indication_is_only_allowed_on_loopback(self):
        self.assertEqual(self.request('/login')[0], 200)
        for headers in ({'Host': 'public.example.invalid'}, {'CF-Connecting-IP': '192.0.2.1'}):
            status, _, body = self.request('/login', extra_headers=headers)
            self.assertEqual(status, 400)
            self.assertEqual(json.loads(body), {'error': 'https_required'})
        self.assertNotIn('Strict-Transport-Security', self.request('/login')[1])


if __name__ == '__main__': unittest.main()
