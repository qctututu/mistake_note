"""
错题本后端 API 服务入口
按功能路由拆分至 routes/ 目录
"""
import sys
import os
import logging

# 强制 Python I/O 使用 UTF-8（Windows 上预防 GBK 编码问题）
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# 确保能导入同级模块
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask
from flask_cors import CORS

from repository.database import init_db
from routes import register_all_routes

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'images')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_IMAGE_EXT = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

# 日志配置
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'backend.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)
logger.info(f'=== 错题本后端启动 (log → {log_file}) ===')


@app.before_request
def _init():
    if not hasattr(app, '_db_inited'):
        init_db()
        app._db_inited = True


register_all_routes(app, logger, UPLOAD_FOLDER, ALLOWED_IMAGE_EXT)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f'服务启动 → http://localhost:{port}')
    print(f"==> 错题本后端启动: http://localhost:{port}")
    print(f"==> API 文档: http://localhost:{port}/api/health")
    print(f"==> 日志文件: {log_file}")
    app.run(host='0.0.0.0', port=port)
