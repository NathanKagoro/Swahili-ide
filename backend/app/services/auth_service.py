import hashlib
import json
import secrets
from base64 import b64decode, b64encode

from fastapi import HTTPException, status

from app.db.database import get_connection, load_progress_map


def _hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000).hex()


def _encode_salt(salt: bytes) -> str:
    return b64encode(salt).decode('ascii')


def _decode_salt(value: str) -> bytes:
    return b64decode(value.encode('ascii'))


def create_user(username: str, password: str) -> dict:
    salt = secrets.token_bytes(16)
    password_hash = _hash_password(password, salt)

    try:
        with get_connection() as conn:
            cursor = conn.execute(
                'INSERT INTO users (username, password_salt, password_hash) VALUES (?, ?, ?)',
                (username.strip().lower(), _encode_salt(salt), password_hash),
            )
            user_id = cursor.lastrowid
            conn.execute('INSERT INTO progress (user_id, completed_lessons_json) VALUES (?, ?)', (user_id, '{}'))
            conn.commit()
    except Exception as exc:
        if 'UNIQUE constraint failed' in str(exc):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Username already exists.') from exc
        raise

    return {'id': user_id, 'username': username.strip().lower()}


def authenticate_user(username: str, password: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT id, username, password_salt, password_hash FROM users WHERE username = ?',
            (username.strip().lower(),),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid username or password.')

    salt = _decode_salt(row['password_salt'])
    attempted_hash = _hash_password(password, salt)
    if attempted_hash != row['password_hash']:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid username or password.')

    return {'id': row['id'], 'username': row['username']}


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with get_connection() as conn:
        conn.execute('INSERT INTO sessions (token, user_id) VALUES (?, ?)', (token, user_id))
        conn.commit()
    return token


def delete_session(token: str) -> None:
    with get_connection() as conn:
        conn.execute('DELETE FROM sessions WHERE token = ?', (token,))
        conn.commit()


def get_user_by_token(token: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            '''
            SELECT users.id, users.username
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            ''',
            (token,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired session.')

    return {'id': row['id'], 'username': row['username']}


def get_progress(user_id: int) -> dict[str, bool]:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT completed_lessons_json FROM progress WHERE user_id = ?',
            (user_id,),
        ).fetchone()

    return load_progress_map(row['completed_lessons_json'] if row else '{}')


def save_progress(user_id: int, completed_lessons: dict[str, bool]) -> dict[str, bool]:
    cleaned = {str(key): bool(value) for key, value in completed_lessons.items()}
    with get_connection() as conn:
        conn.execute(
            '''
            INSERT INTO progress (user_id, completed_lessons_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id)
            DO UPDATE SET completed_lessons_json = excluded.completed_lessons_json, updated_at = CURRENT_TIMESTAMP
            ''',
            (user_id, json.dumps(cleaned, sort_keys=True),),
        )
        conn.commit()
    return cleaned
