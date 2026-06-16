"""
知识库 RAG 系统 - 支持文件上传、分块、检索

检索策略：
  1. 关键词 TF 匹配（基础，无依赖）
  2. 如果配置了 OpenAI API，可使用 embedding 检索（更精准）
"""
import os
import re
import json
import hashlib
import sqlite3
from collections import Counter
import math

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'mistake_note.db')
KB_DIR = os.path.join(BASE_DIR, 'data', 'knowledge_base')
CHUNK_SIZE = 500       # 每块字符数
CHUNK_OVERLAP = 50     # 重叠字符数

# ─── 停用词 ──────────────────────────────────────────
_STOP_WORDS = set(
    '的了是在有和我就不人一个也要你为这会着被没看对上都'
    '但而所如把让与去用能以到很那于由又还出只给因将做'
    '可及或从并同因被这那它们他她它什么哪怎么为什么如何'
    '因为所以虽然但是如果那么而且或者不过然而因此于是'
)


def init_kb():
    os.makedirs(KB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS kb_files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT    NOT NULL,
            filepath    TEXT    NOT NULL,
            file_hash   TEXT    NOT NULL,
            chunk_count INTEGER DEFAULT 0,
            created_at  TEXT    DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS kb_chunks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id     INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            content     TEXT    NOT NULL,
            FOREIGN KEY (file_id) REFERENCES kb_files(id) ON DELETE CASCADE
        );
        -- 全文搜索索引
        CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
            content,
            content='kb_chunks',
            content_rowid='id'
        );
    """)
    conn.commit()
    conn.close()


# ─── 文本分块 ──────────────────────────────────────────

def _split_into_chunks(text: str) -> list:
    """将长文本切分成有重叠的块"""
    # 先按段落分
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current = ''
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) < CHUNK_SIZE:
            current += '\n' + para if current else para
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)

    # 如果块太大，进一步切分
    final_chunks = []
    for ch in chunks:
        if len(ch) <= CHUNK_SIZE:
            final_chunks.append(ch)
        else:
            # 按句子切分
            sentences = re.split(r'(?<=[。！？\n])', ch)
            buf = ''
            for s in sentences:
                if len(buf) + len(s) < CHUNK_SIZE:
                    buf += s
                else:
                    if buf:
                        final_chunks.append(buf)
                    buf = s
            if buf:
                final_chunks.append(buf)

    return final_chunks


# ─── 文件读取 ──────────────────────────────────────────

def _read_file(filepath: str) -> str:
    """读取文件内容为文本，支持 .txt .md .csv"""
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ('.txt', '.md', '.csv', '.json', '.xml'):
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    else:
        raise ValueError(f'不支持的文件格式: {ext}')


# ─── 上传管理 ──────────────────────────────────────────

def upload_file(file_storage):
    """上传文件到知识库"""
    init_kb()

    filename = file_storage.filename
    content = file_storage.read()

    # 先保存文件
    os.makedirs(KB_DIR, exist_ok=True)
    file_hash = hashlib.md5(content).hexdigest()

    # 检查重复
    conn = sqlite3.connect(DB_PATH)
    dup = conn.execute(
        "SELECT id FROM kb_files WHERE file_hash=?", (file_hash,)
    ).fetchone()
    if dup:
        conn.close()
        return {'error': '文件已存在，无需重复上传'}, 409

    # 保存文件
    safe_filename = f"{file_hash}_{filename}"
    filepath = os.path.join(KB_DIR, safe_filename)
    with open(filepath, 'wb') as f:
        f.write(content)

    # 解析文本
    try:
        if filename.endswith('.pdf'):
            text = _parse_pdf(filepath)
        else:
            text = content.decode('utf-8', errors='ignore')
    except Exception as e:
        text = content.decode('utf-8', errors='ignore')

    # 分块
    chunks = _split_into_chunks(text)

    # 入库
    cur = conn.execute(
        "INSERT INTO kb_files (filename, filepath, file_hash, chunk_count) VALUES (?, ?, ?, ?)",
        (filename, filepath, file_hash, len(chunks))
    )
    file_id = cur.lastrowid

    for i, chunk_text in enumerate(chunks):
        cur = conn.execute(
            "INSERT INTO kb_chunks (file_id, chunk_index, content) VALUES (?, ?, ?)",
            (file_id, i, chunk_text)
        )
        chunk_id = cur.lastrowid
        # 更新 FTS 索引
        conn.execute(
            "INSERT INTO kb_chunks_fts (rowid, content) VALUES (?, ?)",
            (chunk_id, chunk_text)
        )

    conn.commit()
    conn.close()

    return {
        'id': file_id,
        'filename': filename,
        'chunks': len(chunks),
        'message': f'上传成功，已切分为 {len(chunks)} 个片段',
    }


def _parse_pdf(filepath: str) -> str:
    """尝试解析 PDF（需要 PyMuPDF / pdfminer）"""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(filepath)
        text = '\n'.join(page.get_text() for page in doc)
        doc.close()
        return text
    except ImportError:
        pass
    try:
        from pdfminer.high_level import extract_text
        return extract_text(filepath)
    except ImportError:
        pass
    # fallback: 尝试 pdftotext 命令行
    try:
        import subprocess
        result = subprocess.run(['pdftotext', filepath, '-'],
                                capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout
    except Exception:
        pass
    return f"[PDF 文件: {os.path.basename(filepath)}，请安装 PyMuPDF 查看内容]"


def list_files():
    """列出知识库文件"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, filename, chunk_count, created_at FROM kb_files ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_file(file_id):
    """删除知识库文件及分块"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # 获取文件路径
    row = conn.execute(
        "SELECT filepath FROM kb_files WHERE id=?", (file_id,)
    ).fetchone()
    if row and os.path.exists(row['filepath']):
        os.remove(row['filepath'])
    # 级联删除 chunks 和 fts
    conn.execute("DELETE FROM kb_chunks_fts WHERE rowid IN "
                 "(SELECT id FROM kb_chunks WHERE file_id=?)", (file_id,))
    conn.execute("DELETE FROM kb_files WHERE id=?", (file_id,))
    conn.commit()
    conn.close()


# ─── 检索 ──────────────────────────────────────────────

def _tokenize(text: str) -> list:
    """中文分词（按字+词切分）"""
    # 简单实现：提取中文词组 + 英文单词
    tokens = []
    # 英文单词
    for w in re.findall(r'[a-zA-Z_]+', text):
        if w.lower() not in _STOP_WORDS:
            tokens.append(w.lower())
    # 中文：用 bi-gram 提高匹配精度
    chars = re.findall(r'[\u4e00-\u9fff]', text)
    for i in range(len(chars) - 1):
        bigram = chars[i] + chars[i + 1]
        if bigram not in _STOP_WORDS:
            tokens.append(bigram)
    # 也保留单个关键字作为兜底
    for c in set(chars):
        if c not in _STOP_WORDS:
            tokens.append(c)
    return tokens


def _compute_tf(tokens: list) -> dict:
    """计算词频"""
    total = len(tokens) or 1
    counter = Counter(tokens)
    return {k: v / total for k, v in counter.items()}


def search_knowledge(query: str, top_k: int = 5):
    """
    用关键词 TF 匹配检索知识库

    返回:
      [{chunk_id, file_id, filename, content, score}, ...]
    """
    init_kb()
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # 先尝试 FTS5 全文搜索
    try:
        fts_query = ' OR '.join(f'"{t}"' for t in query_tokens[:10])
        rows = conn.execute(f"""
            SELECT c.id, c.file_id, c.content, f.filename,
                   rank as score
            FROM kb_chunks_fts
            JOIN kb_chunks c ON c.id = kb_chunks_fts.rowid
            JOIN kb_files f ON f.id = c.file_id
            WHERE kb_chunks_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (fts_query, top_k)).fetchall()
        if rows:
            conn.close()
            return [{
                'chunk_id': r['id'],
                'file_id': r['file_id'],
                'filename': r['filename'],
                'content': r['content'][:500],
                'score': round(1.0 / (1.0 + abs(r['score'])), 4),
            } for r in rows]
    except Exception:
        pass  # FTS 可能某些环境不支持，fallback 到手动

    # Fallback: 手动 TF 匹配
    # Fallback 查询（row_factory 已在上面设置）
    all_chunks = conn.execute("""
        SELECT c.id, c.file_id, c.content, f.filename
        FROM kb_chunks c
        JOIN kb_files f ON f.id = c.file_id
    """).fetchall()

    results = []
    for r in all_chunks:
        chunk_tokens = _tokenize(r['content'])
        if not chunk_tokens:
            continue
        tf = _compute_tf(chunk_tokens)
        score = sum(tf.get(t, 0) for t in query_tokens)
        if score > 0:
            results.append({
                'chunk_id': r['id'],
                'file_id': r['file_id'],
                'filename': r['filename'],
                'content': r['content'][:500],
                'score': round(score, 4),
            })

    results.sort(key=lambda x: x['score'], reverse=True)
    conn.close()
    return results[:top_k]


def retrieve_context(query: str, max_chars: int = 2000) -> str:
    """
    检索知识库并拼接上下文文本
    供 AI 生成时使用
    """
    results = search_knowledge(query, top_k=5)
    if not results:
        return ''

    parts = []
    chars = 0
    for r in results:
        text = f"[来自 {r['filename']}] {r['content']}"
        if chars + len(text) > max_chars:
            break
        parts.append(text)
        chars += len(text)

    return '\n\n'.join(parts)
