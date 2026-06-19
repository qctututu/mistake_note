"""
数据库访问层
"""
import sqlite3
import os
from datetime import datetime, timedelta

DB_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_PATH = os.path.join(DB_DIR, 'mistake_note.db')


def get_db():
    """获取数据库连接（自动创建目录）"""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化数据库表结构"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS subjects (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL UNIQUE,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS questions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id      INTEGER NOT NULL,
            content         TEXT    NOT NULL,        -- 题目内容
            correct_answer  TEXT    NOT NULL,        -- 正确答案
            wrong_answer    TEXT    DEFAULT '',      -- 当时写错的答案
            analysis        TEXT    DEFAULT '',      -- 错因分析
            knowledge_points TEXT   DEFAULT '',       -- 知识点（逗号分隔）
            difficulty      INTEGER DEFAULT 3,       -- 难度 1-5
            source          TEXT    DEFAULT '',       -- 来源（考试/作业/练习）
            created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
            next_review_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
            review_interval INTEGER DEFAULT 0,        -- 上次复习间隔（天）
            ease_factor     REAL    DEFAULT 2.5,      -- SM-2 易度因子
            review_count    INTEGER DEFAULT 0,
            correct_count   INTEGER DEFAULT 0,        -- 复习正确的次数
            images          TEXT    DEFAULT '{}',       -- 图片URL映射 {"content":[...], "correct_answer":[...], "wrong_answer":[...]}
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );

        CREATE TABLE IF NOT EXISTS review_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            review_date TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
            result      TEXT    NOT NULL CHECK(result IN ('correct','wrong','partial')),
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
        );

        -- 插入默认科目
        INSERT OR IGNORE INTO subjects(name) VALUES ('数学');
        INSERT OR IGNORE INTO subjects(name) VALUES ('物理');
        INSERT OR IGNORE INTO subjects(name) VALUES ('化学');
        INSERT OR IGNORE INTO subjects(name) VALUES ('英语');
        INSERT OR IGNORE INTO subjects(name) VALUES ('语文');
        INSERT OR IGNORE INTO subjects(name) VALUES ('生物');
        INSERT OR IGNORE INTO subjects(name) VALUES ('政治');
        INSERT OR IGNORE INTO subjects(name) VALUES ('历史');
        INSERT OR IGNORE INTO subjects(name) VALUES ('地理');
    """)

    # 迁移：为旧数据库添加 images 列
    try:
        conn.execute("ALTER TABLE questions ADD COLUMN images TEXT DEFAULT '{}'")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # 列已存在

    conn.commit()
    conn.close()


# ─── 科目 ──────────────────────────────────────────────

def get_subjects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM subjects ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_subject(name):
    conn = get_db()
    try:
        cur = conn.execute("INSERT INTO subjects(name) VALUES (?)", (name,))
        conn.commit()
        return {"id": cur.lastrowid, "name": name}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


# ─── 错题 ──────────────────────────────────────────────

def add_question(data):
    conn = get_db()
    cur = conn.execute("""
        INSERT INTO questions (subject_id, content, correct_answer, wrong_answer,
                               analysis, knowledge_points, difficulty, source, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['subject_id'], data['content'], data['correct_answer'],
        data.get('wrong_answer', ''), data.get('analysis', ''),
        data.get('knowledge_points', ''), data.get('difficulty', 3),
        data.get('source', ''),
        data.get('images', '{}')
    ))
    conn.commit()
    qid = cur.lastrowid
    conn.close()
    return get_question(qid)


def get_question(qid):
    conn = get_db()
    row = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_question(qid, data):
    conn = get_db()
    fields = []
    vals = []
    for key in ('subject_id', 'content', 'correct_answer', 'wrong_answer',
                'analysis', 'knowledge_points', 'difficulty', 'source', 'images'):
        if key in data:
            fields.append(f"{key}=?")
            vals.append(data[key])
    if fields:
        vals.append(qid)
        conn.execute(f"UPDATE questions SET {', '.join(fields)} WHERE id=?", vals)
        conn.commit()
    conn.close()
    return get_question(qid)


def delete_question(qid):
    conn = get_db()
    conn.execute("DELETE FROM questions WHERE id=?", (qid,))
    conn.commit()
    conn.close()


def list_questions(subject_id=None, knowledge_point=None, search=None,
                   page=1, page_size=20, sort_by='created_at', sort_order='desc'):
    """分页查询错题"""
    conn = get_db()
    conditions = []
    params = []

    if subject_id:
        conditions.append("q.subject_id=?")
        params.append(subject_id)
    if knowledge_point:
        conditions.append("q.knowledge_points LIKE ?")
        params.append(f"%{knowledge_point}%")
    if search:
        conditions.append("(q.content LIKE ? OR q.correct_answer LIKE ? OR q.analysis LIKE ?)")
        s = f"%{search}%"
        params.extend([s, s, s])

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    allowed_sort = {'created_at', 'difficulty', 'review_count', 'next_review_at'}
    order_col = sort_by if sort_by in allowed_sort else 'created_at'
    order_dir = 'ASC' if sort_order.lower() == 'asc' else 'DESC'
    offset = (page - 1) * page_size

    total = conn.execute(f"SELECT COUNT(*) FROM questions q {where}", params).fetchone()[0]
    rows = conn.execute(f"""
        SELECT q.*, s.name AS subject_name
        FROM questions q
        JOIN subjects s ON s.id = q.subject_id
        {where}
        ORDER BY q.{order_col} {order_dir}
        LIMIT ? OFFSET ?
    """, params + [page_size, offset]).fetchall()
    conn.close()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "data": [dict(r) for r in rows]
    }


def get_questions_for_review(limit=10, subject_id=None):
    """获取今天到期的复习题目（按到期时间排序），可选按科目筛选"""
    conn = get_db()
    sql = """
        SELECT q.*, s.name AS subject_name
        FROM questions q
        JOIN subjects s ON s.id = q.subject_id
        WHERE q.next_review_at <= datetime('now','localtime')
    """
    params = []
    if subject_id:
        sql += " AND q.subject_id = ?"
        params.append(subject_id)
    sql += " ORDER BY q.next_review_at ASC LIMIT ?"
    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── 复习日志 ──────────────────────────────────────────

def add_review_log(question_id, result):
    conn = get_db()
    conn.execute(
        "INSERT INTO review_logs(question_id, result) VALUES (?, ?)",
        (question_id, result)
    )
    conn.commit()
    conn.close()


def get_review_history(question_id, limit=20):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM review_logs
        WHERE question_id=?
        ORDER BY review_date DESC
        LIMIT ?
    """, (question_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── 统计 ──────────────────────────────────────────────

def get_stats():
    conn = get_db()
    stats = {}

    # 基础计数
    stats['total_questions'] = conn.execute(
        "SELECT COUNT(*) FROM questions").fetchone()[0]
    stats['total_reviews'] = conn.execute(
        "SELECT COUNT(*) FROM review_logs").fetchone()[0]

    # 今日待复习
    stats['due_reviews'] = conn.execute("""
        SELECT COUNT(*) FROM questions
        WHERE next_review_at <= datetime('now','localtime')
    """).fetchone()[0]

    # 各科分布
    rows = conn.execute("""
        SELECT s.name, COUNT(q.id) AS cnt
        FROM subjects s
        LEFT JOIN questions q ON q.subject_id = s.id
        GROUP BY s.id ORDER BY cnt DESC
    """).fetchall()
    stats['subject_distribution'] = {r['name']: r['cnt'] for r in rows}

    # 难度分布
    rows = conn.execute("""
        SELECT difficulty, COUNT(*) AS cnt
        FROM questions GROUP BY difficulty
    """).fetchall()
    stats['difficulty_distribution'] = {r['difficulty']: r['cnt'] for r in rows}

    # 复习质量统计（最近30天）
    stats['recent_reviews'] = {}
    for result in ('correct', 'wrong', 'partial'):
        cnt = conn.execute("""
            SELECT COUNT(*) FROM review_logs
            WHERE result=? AND review_date >= datetime('now','-30 days','localtime')
        """, (result,)).fetchone()[0]
        stats['recent_reviews'][result] = cnt

    # 掌握率（所有复习中正确的比例）
    total = stats['total_reviews']
    correct = conn.execute(
        "SELECT COUNT(*) FROM review_logs WHERE result='correct'"
    ).fetchone()[0] if total > 0 else 0
    stats['mastery_rate'] = round(correct / total * 100, 1) if total > 0 else 0

    # 各科目掌握率
    subject_mastery = []
    for s in get_subjects():
        sid = s['id']
        t = conn.execute("""
            SELECT COUNT(*) FROM review_logs r
            JOIN questions q ON q.id = r.question_id
            WHERE q.subject_id=?
        """, (sid,)).fetchone()[0]
        if t > 0:
            c = conn.execute("""
                SELECT COUNT(*) FROM review_logs r
                JOIN questions q ON q.id = r.question_id
                WHERE q.subject_id=? AND r.result='correct'
            """, (sid,)).fetchone()[0]
            subject_mastery.append({
                "subject": s['name'],
                "rate": round(c / t * 100, 1),
                "total": t
            })
    stats['subject_mastery'] = subject_mastery

    conn.close()
    return stats
