# -*- coding: utf-8 -*-
"""
修复错题本中的编码问题
检测并清理数据库中已损坏的题目（中文变成问号）

用法:
  python fix_encoding.py          # 只检测，不删除
  python fix_encoding.py --clean  # 检测并删除
"""
import sqlite3
import sys
import os

# Force UTF-8 for stdout on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = os.path.join(os.path.dirname(__file__), 'backend', 'data', 'mistake_note.db')


def find_corrupted():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        'SELECT id, content, correct_answer, wrong_answer, analysis, knowledge_points, subject_id FROM questions'
    ).fetchall()

    corrupted = []
    for r in rows:
        issues = {}
        for field in ['content', 'correct_answer', 'wrong_answer', 'analysis', 'knowledge_points']:
            val = r[field] or ''
            if '?' not in val:
                continue
            non_q = val.replace('?', '').strip()
            has_chinese = any('\u4e00' <= ch <= '\u9fff' for ch in non_q)
            if not has_chinese and non_q:
                issues[field] = val
            elif not non_q and '?' in val:
                issues[field] = val
        if issues:
            corrupted.append((r['id'], issues, r['subject_id']))

    conn.close()
    return corrupted


def main():
    do_clean = '--clean' in sys.argv

    corrupted = find_corrupted()

    print('=' * 60)
    print('  错题本 - 编码损坏检测')
    print('=' * 60)
    print()

    if not corrupted:
        print('没有发现编码损坏的记录')
        return

    print(f'发现 {len(corrupted)} 条记录存在编码损坏（中文变成了问号）')
    print()

    for qid, issues, subj_id in corrupted:
        print(f'  ID={qid}:')
        for field, val in issues.items():
            print(f'    [损坏] {field}: {repr(val[:80])}')
        print()

    if not do_clean:
        print('--- 这只是检测报告，未做任何修改 ---')
        print('如需删除这些损坏记录，运行: python fix_encoding.py --clean')
        return

    # 删除损坏记录
    conn = sqlite3.connect(DB_PATH)
    for qid, _, _ in corrupted:
        conn.execute('DELETE FROM questions WHERE id=?', (qid,))
        print(f'  已删除 ID={qid}')
    conn.commit()
    conn.close()
    print()
    print('完成！已删除所有损坏的记录')
    print('请通过网页上的「录入错题」页面重新录入这些题目。')
    print('建议使用 start.ps1 启动（已设置 PYTHONIOENCODING=utf-8）')


if __name__ == '__main__':
    main()
