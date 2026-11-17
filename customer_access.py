"""Private customer TOTP access, sessions and atomic issuance accounting."""
import base64
from contextlib import contextmanager
import hashlib
import hmac
import os
from pathlib import Path
import secrets
import sqlite3
import struct
import time
from urllib.parse import quote, urlencode

SESSION_SECONDS = 8 * 3600


class AccessError(Exception):
    def __init__(self, code, status=403):
        self.code, self.status = code, status
        super().__init__(code)


def totp(secret, counter, digits=6):
    raw = base64.b32decode(secret + '=' * (-len(secret) % 8))
    digest = hmac.new(raw, struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    number = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff
    return str(number % (10 ** digits)).zfill(digits)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


class CustomerAccess:
    def __init__(self, path, clock=time.time):
        self.path, self.clock = Path(path), clock
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path.parent.chmod(0o700)
        # Create with restrictive permissions before SQLite opens the file.
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        self.path.chmod(0o600)
        with self.db() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, secret TEXT NOT NULL,
                    quota INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0,
                    active INTEGER NOT NULL DEFAULT 1, last_counter INTEGER NOT NULL DEFAULT -1);
                CREATE TABLE IF NOT EXISTS sessions (
                    digest TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE,
                    expires INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS attempts (
                    bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, since INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS issues (
                    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
                    serial TEXT NOT NULL, day TEXT NOT NULL, state TEXT NOT NULL,
                    key_text TEXT, created INTEGER NOT NULL,
                    UNIQUE(customer_id, serial, day));
            ''')
            # A process crash must not automatically retry an ambiguous provider call.
            db.execute("UPDATE issues SET state='uncertain' WHERE state='pending'")

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def public(row):
        return {'id': row['id'], 'name': row['name'], 'quota': row['quota'],
                'used': row['used'], 'remainingKeys': max(0, row['quota'] - row['used']),
                'active': bool(row['active'])}

    def list_customers(self):
        with self.db() as db:
            customers = [self.public(row) for row in db.execute('SELECT * FROM customers ORDER BY rowid DESC')]
            uncertain = [dict(row) for row in db.execute(
                "SELECT id,customer_id,serial,day,created FROM issues WHERE state='uncertain'")]
            return {'customers': customers, 'uncertainRequests': uncertain}

    def provision(self, name=None, quota=None, customer_id=None):
        if customer_id is None:
            if (not isinstance(name, str) or not 1 <= len(name.strip()) <= 80
                    or any(ord(c) < 32 for c in name)
                    or type(quota) is not int or not 1 <= quota <= 10000):
                raise AccessError('invalid_customer', 400)
            customer_id = 'CP-' + secrets.token_hex(4).upper()
        secret = base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')
        with self.db() as db:
            if name is not None:
                db.execute('INSERT INTO customers(id,name,secret,quota) VALUES(?,?,?,?)',
                           (customer_id, name.strip(), secret, quota))
            else:
                if not db.execute('SELECT 1 FROM customers WHERE id=?', (customer_id,)).fetchone():
                    raise AccessError('customer_not_found', 404)
                db.execute('UPDATE customers SET secret=?,last_counter=-1 WHERE id=?', (secret, customer_id))
                db.execute('DELETE FROM sessions WHERE customer_id=?', (customer_id,))
            row = db.execute('SELECT * FROM customers WHERE id=?', (customer_id,)).fetchone()
        result = self.public(row)
        result['setupUri'] = 'otpauth://totp/' + quote('ADBAUTHKEY:' + customer_id, safe='') + '?' + urlencode({
            'secret': secret, 'issuer': 'ADBAUTHKEY', 'algorithm': 'SHA1', 'digits': 6, 'period': 30})
        return result

    def update(self, customer_id, action, amount=None):
        with self.db() as db:
            if action == 'add_keys':
                if type(amount) is not int or not 1 <= amount <= 10000:
                    raise AccessError('invalid_amount', 400)
                change = db.execute('UPDATE customers SET quota=quota+? WHERE id=?', (amount, customer_id))
            elif action == 'disable':
                change = db.execute('UPDATE customers SET active=0 WHERE id=?', (customer_id,))
                db.execute('DELETE FROM sessions WHERE customer_id=?', (customer_id,))
            elif action == 'enable':
                change = db.execute('UPDATE customers SET active=1 WHERE id=?', (customer_id,))
            else:
                raise AccessError('invalid_action', 400)
            if not change.rowcount:
                raise AccessError('customer_not_found', 404)

    def login(self, customer_id, code, address):
        now = int(self.clock())
        if not isinstance(customer_id, str) or not isinstance(code, str):
            raise AccessError('invalid_login', 401)
        customer_id, code = customer_id.strip().upper(), code.strip()
        bucket = token_hash(address)
        failure = None
        with self.db() as db:
            db.execute('DELETE FROM attempts WHERE since<?', (now - 600,))
            attempt = db.execute('SELECT * FROM attempts WHERE bucket=?', (bucket,)).fetchone()
            if attempt and attempt['count'] >= 10:
                raise AccessError('login_rate_limited', 429)
            row = db.execute('SELECT * FROM customers WHERE id=?', (customer_id,)).fetchone()
            counter = now // 30
            matched = None
            if row and row['active'] and len(code) == 6 and code.isascii() and code.isdigit():
                for step in (counter - 1, counter, counter + 1):
                    if step >= 0 and hmac.compare_digest(totp(row['secret'], step), code):
                        matched = step
            if matched is None or matched <= row['last_counter']:
                db.execute('''INSERT INTO attempts(bucket,count,since) VALUES(?,1,?)
                    ON CONFLICT(bucket) DO UPDATE SET count=count+1''', (bucket, now))
                failure = AccessError('invalid_login', 401)
            else:
                token = secrets.token_urlsafe(32)
                db.execute('UPDATE customers SET last_counter=? WHERE id=?', (matched, customer_id))
                db.execute('DELETE FROM sessions WHERE customer_id=? OR expires<?', (customer_id, now))
                db.execute('INSERT INTO sessions VALUES(?,?,?)', (token_hash(token), customer_id, now + SESSION_SECONDS))
                db.execute('DELETE FROM attempts WHERE bucket=?', (bucket,))
        if failure:
            raise failure
        return token, self.public(row)

    def authenticate(self, token):
        if not token or len(token) > 128:
            return None
        with self.db() as db:
            row = db.execute('''SELECT c.*,s.expires FROM sessions s JOIN customers c ON c.id=s.customer_id
                WHERE s.digest=? AND s.expires>? AND c.active=1''', (token_hash(token), int(self.clock()))).fetchone()
            return {**self.public(row), 'sessionExpiresAt': row['expires']} if row else None

    def customer(self, customer_id):
        with self.db() as db:
            row = db.execute('SELECT * FROM customers WHERE id=?', (customer_id,)).fetchone()
            return self.public(row) if row else None

    def logout(self, token):
        with self.db() as db:
            db.execute('DELETE FROM sessions WHERE digest=?', (token_hash(token or ''),))

    def reserve(self, customer_id, serial, day):
        with self.db() as db:
            existing = db.execute('SELECT * FROM issues WHERE customer_id=? AND serial=? AND day=?',
                                  (customer_id, serial, day)).fetchone()
            if existing and existing['state'] == 'done':
                return {'cached': existing['key_text']}
            if existing and existing['state'] in ('pending', 'uncertain'):
                raise AccessError('request_needs_review', 409)
            if not db.execute('UPDATE customers SET used=used+1 WHERE id=? AND active=1 AND used<quota',
                              (customer_id,)).rowcount:
                raise AccessError('customer_no_remaining_keys', 403)
            issue_id = secrets.token_hex(16)
            if existing:
                db.execute('DELETE FROM issues WHERE id=?', (existing['id'],))
            db.execute('INSERT INTO issues(id,customer_id,serial,day,state,created) VALUES(?,?,?,?,?,?)',
                       (issue_id, customer_id, serial, day, 'pending', int(self.clock())))
            return {'issue_id': issue_id}

    def finish(self, issue_id, key_text=None, certain_failure=False):
        with self.db() as db:
            row = db.execute("SELECT * FROM issues WHERE id=? AND state='pending'", (issue_id,)).fetchone()
            if not row:
                return
            state = 'done' if key_text is not None else 'failed' if certain_failure else 'uncertain'
            db.execute('UPDATE issues SET state=?,key_text=? WHERE id=?', (state, key_text, issue_id))
            if certain_failure:
                db.execute('UPDATE customers SET used=MAX(0,used-1) WHERE id=?', (row['customer_id'],))

    def release_uncertain(self, issue_id):
        with self.db() as db:
            row = db.execute("SELECT * FROM issues WHERE id=? AND state='uncertain'", (issue_id,)).fetchone()
            if not row:
                raise AccessError('request_not_pending_review', 409)
            db.execute("UPDATE issues SET state='failed' WHERE id=?", (issue_id,))
            db.execute('UPDATE customers SET used=MAX(0,used-1) WHERE id=?', (row['customer_id'],))
