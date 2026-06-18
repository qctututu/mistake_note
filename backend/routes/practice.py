from flask import request, jsonify

from repository.database import get_question, list_questions
from services.question_modifier import batch_modify
from services.knowledge_base import retrieve_context
from services.ai_model import (
    load_config as load_ai_config,
    generate_similar_question,
    grade_practice_answer,
    generate_problem_analysis,
)


def register_practice_routes(app):
    @app.route('/api/practice/generate', methods=['POST'])
    def api_practice_generate():
        data = request.get_json()
        count = data.get('count', 5)
        subject_id = data.get('subject_id')
        use_ai = data.get('use_ai', True)

        params = {'page': 1, 'page_size': 9999}
        if subject_id:
            params['subject_id'] = subject_id
        pool = list_questions(**params)['data']

        if not pool:
            return jsonify({'error': '暂无题目'}), 404

        ai_config = load_ai_config()
        ai_available = bool(ai_config.get('api_key'))

        if use_ai and ai_available:
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
                        images=q.get('images', '{}'),
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

        modified = batch_modify(pool, count=count)
        return jsonify(modified)

    @app.route('/api/practice/grade', methods=['POST'])
    def api_practice_grade():
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
            images=q.get('images', '{}'),
        )
        return jsonify(result)

    @app.route('/api/practice/generate-from-question', methods=['POST'])
    def api_practice_generate_from_question():
        data = request.get_json()
        question_id = data.get('question_id')
        count = data.get('count', 1)

        if not question_id:
            return jsonify({'error': '缺少 question_id'}), 400

        q = get_question(question_id)
        if not q:
            return jsonify({'error': '题目不存在'}), 404

        kb_ctx = retrieve_context(q.get('content', '') + ' ' + q.get('knowledge_points', ''))
        results = []
        for i in range(count):
            try:
                result = generate_similar_question(
                    original_question=q.get('content', ''),
                    correct_answer=q.get('correct_answer', ''),
                    wrong_answer=q.get('wrong_answer', ''),
                    analysis=q.get('analysis', ''),
                    knowledge_points=q.get('knowledge_points', ''),
                    subject=q.get('subject_name', ''),
                    kb_context=kb_ctx,
                    images=q.get('images', '{}'),
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

    @app.route('/api/practice/analyze', methods=['POST'])
    def api_practice_analyze():
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
            return jsonify({'analysis': '未配置 AI 模型，请在「AI 模型」页面配置后使用'})

        result = generate_problem_analysis(
            original_question=q['content'],
            original_answer=q['correct_answer'],
            modified_content=modified_content,
            modified_correct_answer=modified_correct_answer,
            user_answer=user_answer,
            is_correct=is_correct,
            user_answer_images=user_answer_images,
            images=q.get('images', '{}'),
        )
        return jsonify(result)
