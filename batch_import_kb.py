# -*- coding: utf-8 -*-
"""
批量导入文件到知识库

用法:
  1. 把文件放到 backend/data/knowledge_base/ 目录下
  2. 运行: python batch_import_kb.py

支持的格式: .txt .md .csv .pdf
"""
import sys
import os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# 将项目根目录加入 sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from services.knowledge_base import init_kb, upload_file
import io


class FileObj:
    """模拟 Flask 的 file_storage"""
    def __init__(self, path):
        self.path = path
        self.filename = os.path.basename(path)
        with open(path, 'rb') as f:
            self._data = f.read()

    def read(self):
        return self._data


def main():
    kb_dir = os.path.join(os.path.dirname(__file__), 'backend', 'data', 'knowledge_base')

    if not os.path.isdir(kb_dir):
        print(f'知识库目录不存在: {kb_dir}')
        print('请先启动一次后端（会自动创建该目录），或手动创建')
        return

    # 列举已有文件（按哈希名存储的）
    existing_hashes = set()
    for fname in os.listdir(kb_dir):
        if '_' in fname:
            existing_hashes.add(fname.split('_')[0])

    # 扫描待导入的文件（排除已导入的）
    files_to_import = []
    for fname in os.listdir(kb_dir):
        filepath = os.path.join(kb_dir, fname)
        if not os.path.isfile(filepath):
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext not in ('.txt', '.md', '.csv', '.pdf'):
            continue
        # 跳过已导入的哈希文件（已经通过 web 导入过的）
        if '_' in fname and fname.split('_')[0] in existing_hashes and existing_hashes != {''}:
            # 如果不是纯哈希前缀命名的文件（即这个文件名本身就有 hash 前缀）
            # 说明可能是之前 web 导入生成的，跳过
            pass
        files_to_import.append(filepath)

    if not files_to_import:
        print(f'在 {kb_dir} 中未找到待导入的文件')
        print('请把 .txt / .md / .csv / .pdf 文件放进该目录后重新运行')
        return

    print(f'找到 {len(files_to_import)} 个文件待导入:')
    for fp in files_to_import:
        print(f'  📄 {os.path.basename(fp)}')
    print()

    init_kb()
    success = 0
    failed = 0

    for filepath in files_to_import:
        fname = os.path.basename(filepath)
        print(f'正在导入: {fname} ... ', end='', flush=True)
        try:
            fobj = FileObj(filepath)
            # 用 upload_file 走完整导入流程（分块+建索引）
            result = upload_file(fobj)
            if isinstance(result, tuple) and 'error' in result[0]:
                print(f'⚠️  {result[0]["error"]}')
                failed += 1
            elif isinstance(result, dict) and result.get('chunks'):
                print(f'✅ {result["chunks"]} 个片段')
                success += 1
            else:
                print('✅')
                success += 1
        except Exception as e:
            print(f'❌ {str(e)}')
            failed += 1

    print()
    print(f'导入完成: ✅ {success} 成功, ❌ {failed} 失败')
    print('刷新前端知识库页面即可看到导入的文件')


if __name__ == '__main__':
    main()
