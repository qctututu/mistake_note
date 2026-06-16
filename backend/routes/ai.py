from flask import request, jsonify

from repository.database import get_question
from services.ai_model import (
    load_config as load_ai_config,
    save_config as save_ai_config,
    clear_config as clear_ai_config,
    test_connection as test_ai_connection,
    generate_similar_question,
)
from services.knowledge_base import retrieve_context


def register_ai_routes(app):
    @app.route('/api/ai/config', methods=['GET'])
    def api_ai_get_config():
        config = load_ai_config()
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
        if request.method == 'POST':
            data = request.get_json(silent=True)
            if data:
                save_ai_config(data)
        ok, msg = test_ai_connection()
        return jsonify({'connected': ok, 'message': msg})

    @app.route('/api/ai/generate', methods=['POST'])
    def api_ai_generate():
        data = request.get_json()
        qid = data.get('question_id')
        if not qid:
            return jsonify({'error': '缺少 question_id'}), 400

        q = get_question(qid)
        if not q:
            return jsonify({'error': '题目不存在'}), 404

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

    @app.route('/api/ai/status', methods=['GET'])
    def api_ai_status():
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
