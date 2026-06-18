import os
import uuid
import json

from flask import request, jsonify

from repository.database import add_question, get_question, update_question, delete_question, list_questions


def _check_encoding(text: str, field_name: str) -> str | None:
    if not text:
        return None
    if '?' not in text:
        return None
    q_count = text.count('?')
    if q_count > 0:
        non_q = text.replace('?', '').strip()
        has_real_chinese = any('\u4e00' <= ch <= '\u9fff' for ch in non_q)
        if not has_real_chinese and len(non_q) > 0:
            return f'{field_name} 中的中文似乎已损坏（变成了问号），请确认输入法编码正确'
    return None


def _save_images_from_request(request, upload_folder, allowed_image_ext, field_prefix='image_'):
    """从 multipart 请求中提取并保存图片文件，返回 { fieldName: [url, ...] }"""
    import re
    result = {}
    for key in request.files:
        # 匹配 image_content_0, image_correct_answer_1 等
        m = re.match(r'^image_(content|correct_answer|wrong_answer)_(\d+)$', key)
        if not m:
            continue
        field = m.group(1)
        f = request.files[key]
        if f.filename == '':
            continue
        ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
        if ext not in allowed_image_ext:
            ext = 'png'  # fallback
        filename = f'{uuid.uuid4().hex}.{ext}'
        f.save(os.path.join(upload_folder, filename))
        port = int(os.environ.get('PORT', 5000))
        url = f'http://localhost:{port}/uploads/images/{filename}'
        result.setdefault(field, []).append(url)
    return result


def register_question_routes(app, logger, upload_folder, allowed_image_ext):
    @app.route('/api/questions', methods=['GET'])
    def api_list_questions():
        subject_id = request.args.get('subject_id', type=int)
        knowledge_point = request.args.get('knowledge_point')
        search = request.args.get('search')
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 20, type=int)
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        return jsonify(list_questions(
            subject_id=subject_id,
            knowledge_point=knowledge_point,
            search=search,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        ))

    @app.route('/api/questions', methods=['POST'])
    def api_add_question():
        # 支持 JSON 和 multipart/form-data 两种提交方式
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = {
                'subject_id': int(request.form.get('subject_id', 0)),
                'content': request.form.get('content', ''),
                'correct_answer': request.form.get('correct_answer', ''),
                'wrong_answer': request.form.get('wrong_answer', ''),
                'analysis': request.form.get('analysis', ''),
                'knowledge_points': request.form.get('knowledge_points', ''),
                'difficulty': int(request.form.get('difficulty', 3)),
                'source': request.form.get('source', ''),
            }
            # 保存随表单提交的图片文件
            images_map = _save_images_from_request(request, upload_folder, allowed_image_ext)
            data['images'] = json.dumps(images_map, ensure_ascii=False)
        else:
            data = request.get_json()
            if data and 'images' not in data:
                data['images'] = '{}'

        required = ['subject_id', 'content', 'correct_answer']
        for field in required:
            if not data or not data.get(field):
                return jsonify({'error': f'缺少必填字段: {field}'}), 400

        for field in ['content', 'correct_answer', 'wrong_answer', 'analysis', 'knowledge_points']:
            err = _check_encoding(data.get(field, ''), field)
            if err:
                logger.warning(f'编码检测拦截: {err}')
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
