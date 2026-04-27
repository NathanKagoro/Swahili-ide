from app.db.database import get_connection


def save_chat_messages(user_id: int, messages: list[dict]) -> list[dict]:
    cleaned = []
    for message in messages:
        role = (message.get('role') or '').strip().lower()
        if role not in {'user', 'assistant'}:
            continue
        text = (message.get('text') or '').strip()
        if not text:
            continue
        code = (message.get('code') or '').strip() or None
        cleaned.append({'role': role, 'text': text, 'code': code})

    if not cleaned:
        return []

    with get_connection() as conn:
        for item in cleaned:
            conn.execute(
                'INSERT INTO chat_history (user_id, role, text, code) VALUES (?, ?, ?, ?)',
                (user_id, item['role'], item['text'], item['code']),
            )

        # Keep only the most recent 50 chat messages per user to limit DB growth.
        conn.execute(
            '''
            DELETE FROM chat_history
            WHERE user_id = ?
              AND id NOT IN (
                  SELECT id
                  FROM chat_history
                  WHERE user_id = ?
                  ORDER BY created_at DESC, id DESC
                  LIMIT 50
              )
            ''',
            (user_id, user_id),
        )
        conn.commit()

    return get_chat_messages(user_id=user_id, limit=20)


def get_chat_messages(user_id: int, limit: int = 20) -> list[dict]:
    safe_limit = max(1, min(limit, 50))
    with get_connection() as conn:
        rows = conn.execute(
            '''
            SELECT role, text, code, created_at
            FROM chat_history
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            ''',
            (user_id, safe_limit),
        ).fetchall()

    ordered = list(reversed(rows))
    return [
        {
            'role': row['role'],
            'text': row['text'],
            'code': row['code'],
            'created_at': row['created_at'],
        }
        for row in ordered
    ]
