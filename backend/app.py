"""
错题本后端 API 服务
Flask + SQLite + SM-2 遗忘曲线
"""
import sys
import os
import re
import uuid

# 强制 Python I/O 使用 UTF-8（Windows 上预防 GBK 编码问题）
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# 确保能导入同级模块
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from models import (
    init_db, get_subjects, add_subject,
    add_question, get_question, update_question, delete_question,
    list_questions, get_questions_for_review, add_review_log,
    get_review_history, get_stats,
)
from spaced_repetition import calculate_next_review, get_review_forecast
from question_modifier import modify_question, batch_modify
from ai_model import (
    load_config as load_ai_config,
    save_config as save_ai_config,
    clear_config as clear_ai_config,
    test_connection as test_ai_connection,
    generate_similar_question,
    grade_practice_answer,
    generate_problem_analysis,
)
from knowledge_base import init_kb, upload_file as kb_upload, list_files as kb_list_files,\
    delete_file as kb_delete_file, search_knowledge, retrieve_context

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'images')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_IMAGE_EXT = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

# ─── 日志配置 ──────────────────────────────────────────
import logging
_log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(_log_dir, exist_ok=True)
_log_file = os.path.join(_log_dir, 'backend.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(_log_file, encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
_logger = logging.getLogger(__name__)
_logger.info(f'=== 错题本后端启动 (log → {_log_file}) ===')


# ─── 初始化 ────────────────────────────────────────────

@app.before_request
def _init():
    if not hasattr(app, '_db_inited'):
        init_db()
        app._db_inited = True


# ─── 科目 API ─────────────────────────────────────────

@app.route('/api/subjects', methods=['GET'])
def api_get_subjects():
    return jsonify(get_subjects())


@app.route('/api/subjects', methods=['POST'])
def api_add_subject():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': '科目名称不能为空'}), 400
    result = add_subject(data['name'].strip())
    if result is None:
        return jsonify({'error': '科目已存在'}), 409
    return jsonify(result), 201


# ─── 错题 API ─────────────────────────────────────────

@app.route('/api/questions', methods=['GET'])
def api_list_questions():
    """分页查询错题"""
    subject_id = request.args.get('subject_id', type=int)
    knowledge_point = request.args.get('knowledge_point')
    search = request.args.get('search')
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    sort_by = request.args.get('sort_by', 'created_at')
    sort_order = request.args.get('sort_order', 'desc')
    return jsonify(list_questions(
        subject_id=subject_id, knowledge_point=knowledge_point,
        search=search, page=page, page_size=page_size,
        sort_by=sort_by, sort_order=sort_order
    ))


def _check_encoding(text: str, field_name: str) -> str | None:
    """检查文本是否存在编码损坏（中文变成问号），如有则返回错误信息"""
    if not text:
        return None
    if '?' not in text:
        return None
    # 如果 ? 数量占比超过 20%，采样检查是否疑似编码损坏
    q_count = text.count('?')
    if q_count > 0:
        non_q = text.replace('?', '').strip()
        has_real_chinese = any('\u4e00' <= ch <= '\u9fff' for ch in non_q)
        if not has_real_chinese and len(non_q) > 0:
            return f'{field_name} 中的中文似乎已损坏（变成了问号），请确认输入法编码正确'
    return None


@app.route('/api/questions', methods=['POST'])
def api_add_question():
    data = request.get_json()
    required = ['subject_id', 'content', 'correct_answer']
    for field in required:
        if not data or not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400

    # 编码校验：防止中文变成问号写入
    for field in ['content', 'correct_answer', 'wrong_answer', 'analysis', 'knowledge_points']:
        err = _check_encoding(data.get(field, ''), field)
        if err:
            _logger.warning(f'编码检测拦截: {err}')
            return jsonify({'error': err}), 400

    q = add_question(data)
    return jsonify(q), 201


@app.route('/api/questions/<int:qid>', methods=['GET'])
def api_get_question(qid):
    q = get_question(qid)
    if not q:
        return jsonify({'error': '题目不存在'}), 404
    return jsonify(q)


@app.route('/api/questions/<int:qid>', methods=['PUT'])
def api_update_question(qid):
    data = request.get_json()
    q = update_question(qid, data)
    if not q:
        return jsonify({'error': '题目不存在'}), 404
    return jsonify(q)


@app.route('/api/questions/<int:qid>', methods=['DELETE'])
def api_delete_question(qid):
    q = get_question(qid)
    if not q:
        return jsonify({'error': '题目不存在'}), 404
    delete_question(qid)
    return jsonify({'message': '已删除'}), 200


# ─── 复习 API ──────────────────────────────────────────

@app.route('/api/review/due', methods=['GET'])
def api_review_due():
    """获取今天到期的复习题"""
    limit = request.args.get('limit', 10, type=int)
    questions = get_questions_for_review(limit=limit)
    return jsonify(questions)


@app.route('/api/review/submit', methods=['POST'])
def api_review_submit():
    """提交复习结果，更新 SM-2 参数"""
    data = request.get_json()
    qid = data.get('question_id')
    result = data.get('result')

    if not qid or result not in ('correct', 'wrong', 'partial'):
        return jsonify({'error': '参数无效'}), 400

    q = get_question(qid)
    if not q:
        return jsonify({'error': '题目不存在'}), 404

    # 新增复习日志
    add_review_log(qid, result)

    # 计算下次复习
    next_review_at, interval, ef, count = calculate_next_review(q, result)

    # 更新题目
    update_question(qid, {
        'next_review_at': next_review_at,
        'review_interval': interval,
        'ease_factor': ef,
        'review_count': count,
        'correct_count': q['correct_count'] + (1 if result == 'correct' else 0),
    })

    return jsonify({
        'message': '复习记录已保存',
        'next_review_at': next_review_at,
        'interval_days': interval,
        'ease_factor': ef,
    })


@app.route('/api/review/history/<int:qid>', methods=['GET'])
def api_review_history(qid):
    return jsonify(get_review_history(qid))


@app.route('/api/review/forecast', methods=['GET'])
def api_review_forecast():
    """未来复习量预测"""
    from models import list_questions
    # 获取所有题目
    all_q = list_questions(page=1, page_size=9999)['data']
    forecast = get_review_forecast(all_q, days=30)
    return jsonify(forecast)


# ─── AI 模型配置 API ──────────────────────────────────

@app.route('/api/ai/config', methods=['GET'])
def api_ai_get_config():
    config = load_ai_config()
    # 不暴露完整 key
    if config.get('api_key'):
        key = config['api_key']
        config['api_key_masked'] = key[:6] + '*' * (len(key) - 8) + key[-4:] if len(key) > 12 else '****'
    return jsonify(config)


@app.route('/api/ai/config', methods=['POST'])
def api_ai_set_config():
    data = request.get_json()
    if not data:
        return jsonify({'error': '无效数据'}), 400
    save_ai_config(data)
    return jsonify({'message': '配置已保存'})


@app.route('/api/ai/config', methods=['DELETE'])
def api_ai_clear_config():
    clear_ai_config()
    return jsonify({'message': '配置已清除'})


@app.route('/api/ai/test', methods=['GET', 'POST'])
def api_ai_test():
    """测试模型连接"""
    if request.method == 'POST':
        # 测试时带参数：先保存再测（上传新配置并验证）
        data = request.get_json(silent=True)
        if data:
            save_ai_config(data)
    # GET 或空 POST：直接用已保存的配置测试
    ok, msg = test_ai_connection()
    return jsonify({'connected': ok, 'message': msg})


@app.route('/api/ai/generate', methods=['POST'])
def api_ai_generate():
    """用 AI 生成相似题（练习模式核心）"""
    data = request.get_json()
    qid = data.get('question_id')
    if not qid:
        return jsonify({'error': '缺少 question_id'}), 400

    q = get_question(qid)
    if not q:
        return jsonify({'error': '题目不存在'}), 404

    # 检索知识库
    kb_ctx = retrieve_context(q.get('content', '') + ' ' + q.get('knowledge_points', ''))

    result = generate_similar_question(
        original_question=q.get('content', ''),
        correct_answer=q.get('correct_answer', ''),
        wrong_answer=q.get('wrong_answer', ''),
        analysis=q.get('analysis', ''),
        knowledge_points=q.get('knowledge_points', ''),
        subject=q.get('subject_name', ''),
        kb_context=kb_ctx,
    )
    return jsonify(result)


# ─── 知识库 API ───────────────────────────────────────

@app.route('/api/kb/init', methods=['POST'])
def api_kb_init():
    init_kb()
    return jsonify({'message': '知识库已初始化'})


@app.route('/api/kb/upload', methods=['POST'])
def api_kb_upload():
    if 'file' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    result = kb_upload(f)
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 201


@app.route('/api/kb/files', methods=['GET'])
def api_kb_files():
    return jsonify(kb_list_files())


@app.route('/api/kb/files/<int:fid>', methods=['DELETE'])
def api_kb_delete_file(fid):
    kb_delete_file(fid)
    return jsonify({'message': '已删除'})


@app.route('/api/kb/search', methods=['POST'])
def api_kb_search():
    data = request.get_json()
    query = data.get('query', '')
    if not query:
        return jsonify([])
    results = search_knowledge(query)
    return jsonify(results)


# ─── 练习模式 API ─────────────────────────────────────

@app.route('/api/practice/generate', methods=['POST'])
def api_practice_generate():
    """生成变形练习题 - 优先用 AI，AI 不可用时回退规则引擎"""
    data = request.get_json()
    count = data.get('count', 5)
    subject_id = data.get('subject_id')
    use_ai = data.get('use_ai', True)

    # 获取可用题目池
    params = {'page': 1, 'page_size': 9999}
    if subject_id:
        params['subject_id'] = subject_id
    pool = list_questions(**params)['data']

    if not pool:
        return jsonify({'error': '暂无题目'}), 404

    # 检查 AI 是否可用
    ai_config = load_ai_config()
    ai_available = bool(ai_config.get('api_key'))

    if use_ai and ai_available:
        # 用 AI 生成（allow reuse：pool 题不够时从同一道原题生成多个变体）
        import random
        selected = random.choices(pool, k=count) if count > len(pool) else random.sample(pool, k=count)
        results = []
        for q in selected:
            kb_ctx = retrieve_context(q.get('content', '') + ' ' + q.get('knowledge_points', ''))
            try:
                result = generate_similar_question(
                    original_question=q.get('content', ''),
                    correct_answer=q.get('correct_answer', ''),
                    wrong_answer=q.get('wrong_answer', ''),
                    analysis=q.get('analysis', ''),
                    knowledge_points=q.get('knowledge_points', ''),
                    subject=q.get('subject_name', ''),
                    kb_context=kb_ctx,
                )
                results.append({
                    'original_id': q['id'],
                    'subject': q.get('subject_name', ''),
                    'knowledge_points': q.get('knowledge_points', ''),
                    'modified_content': result.get('question', ''),
                    'modified_correct_answer': result.get('answer', ''),
                    'hint': result.get('hint', ''),
                    'changed_aspects': result.get('changed_aspects', ''),
                    'strategies_used': ['AI 生成'],
                })
            except Exception as e:
                results.append({
                    'original_id': q['id'],
                    'subject': q.get('subject_name', ''),
                    'error': str(e),
                })
        return jsonify(results)
    else:
        # 回退到规则引擎
        modified = batch_modify(pool, count=count)
        return jsonify(modified)


@app.route('/api/ai/status', methods=['GET'])
def api_ai_status():
    """检查 AI 模型是否已配置"""
    config = load_ai_config()
    has_key = bool(config.get('api_key'))
    has_model = bool(config.get('model_name'))
    return jsonify({
        'configured': has_key and has_model,
        'has_key': has_key,
        'has_model': has_model,
        'model': config.get('model_name', ''),
        'model_type': config.get('model_type', ''),
    })


@app.route('/api/practice/grade', methods=['POST'])
def api_practice_grade():
    """AI 批改变形题答案"""
    data = request.get_json()
    qid = data.get('question_id')
    user_answer = data.get('user_answer', '').strip()
    user_answer_images = data.get('user_answer_images', [])

    if not qid:
        return jsonify({'error': '参数无效'}), 400

    q = get_question(qid)
    if not q:
        return jsonify({'error': '题目不存在'}), 404

    modified_content = data.get('modified_content', q['content'])
    modified_correct_answer = data.get('modified_correct_answer', q['correct_answer'])

    # 检查 AI 是否可用
    ai_cfg = load_ai_config()
    if not ai_cfg.get('api_key'):
        return jsonify({
            'is_correct': False,
            'feedback': '未配置 AI 模型，请在「AI 模型」页面配置后使用',
            'fallback_hint': '原题答案：' + q['correct_answer'],
        })

    result = grade_practice_answer(
        original_question=q['content'],
        original_answer=q['correct_answer'],
        modified_content=modified_content,
        modified_correct_answer=modified_correct_answer,
        user_answer=user_answer,
        user_answer_images=user_answer_images,
    )
    return jsonify(result)


@app.route('/api/practice/analyze', methods=['POST'])
def api_practice_analyze():
    """AI 生成变形题解析"""
    data = request.get_json()
    qid = data.get('question_id')
    user_answer = data.get('user_answer', '').strip()
    user_answer_images = data.get('user_answer_images', [])
    is_correct = data.get('is_correct', False)

    if not qid:
        return jsonify({'error': '参数无效'}), 400

    q = get_question(qid)
    if not q:
        return jsonify({'error': '题目不存在'}), 404

    modified_content = data.get('modified_content', q['content'])
    modified_correct_answer = data.get('modified_correct_answer', q['correct_answer'])

    ai_cfg = load_ai_config()
    if not ai_cfg.get('api_key'):
        return jsonify({
            'analysis': '未配置 AI 模型，请在「AI 模型」页面配置后使用',
        })

    result = generate_problem_analysis(
        original_question=q['content'],
        original_answer=q['correct_answer'],
        modified_content=modified_content,
        modified_correct_answer=modified_correct_answer,
        user_answer=user_answer,
        is_correct=is_correct,
        user_answer_images=user_answer_images,
    )
    return jsonify(result)


# ─── 统计 API ──────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def api_stats():
    return jsonify(get_stats())


# ─── 图片上传 ──────────────────────────────────────────

@app.route('/api/upload-image', methods=['POST'])
def api_upload_image():
    """上传图片，返回可直接显示的 URL"""
    if 'image' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    f = request.files['image']
    if f.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
    if ext not in ALLOWED_IMAGE_EXT:
        supported = ', '.join(sorted(ALLOWED_IMAGE_EXT))
        return jsonify({'error': f'不支持的文件类型，仅支持: {supported}'}), 400

    filename = f'{uuid.uuid4().hex}.{ext}'
    f.save(os.path.join(UPLOAD_FOLDER, filename))

    # 使用绝对 URL 以便 file:// 前端也能加载
    port = int(os.environ.get('PORT', 5000))
    url = f'http://localhost:{port}/uploads/images/{filename}'
    return jsonify({'url': url, 'filename': filename}), 201


@app.route('/uploads/images/<path:filename>')
def serve_uploaded_image(filename):
    """提供上传的图片文件"""
    return send_from_directory(UPLOAD_FOLDER, filename)


# ─── 健康检查 ─────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def api_health():
    return jsonify({'status': 'ok', 'version': '1.0.0'})


# ─── 启动 ──────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    _logger.info(f'服务启动 → http://localhost:{port}')
    print(f"==> 错题本后端启动: http://localhost:{port}")
    print(f"==> API 文档: http://localhost:{port}/api/health")
    print(f"==> 日志文件: {_log_file}")
    app.run(host='0.0.0.0', port=port)
