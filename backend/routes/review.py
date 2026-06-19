from flask import request, jsonify

from repository.database import get_question, update_question, get_questions_for_review, add_review_log, get_review_history, list_questions
from services.spaced_repetition import calculate_next_review, get_review_forecast


def register_review_routes(app):
    @app.route('/api/review/due', methods=['GET'])
    def api_review_due():
        limit = request.args.get('limit', 10, type=int)
        subject_id = request.args.get('subject_id', None, type=int)
        questions = get_questions_for_review(limit=limit, subject_id=subject_id)
        return jsonify(questions)

    @app.route('/api/review/submit', methods=['POST'])
    def api_review_submit():
        data = request.get_json()
        qid = data.get('question_id')
        result = data.get('result')

        if not qid or result not in ('correct', 'wrong', 'partial'):
            return jsonify({'error': '参数无效'}), 400

        q = get_question(qid)
        if not q:
            return jsonify({'error': '题目不存在'}), 404

        add_review_log(qid, result)
        next_review_at, interval, ef, count = calculate_next_review(q, result)

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
        all_q = list_questions(page=1, page_size=9999)['data']
        forecast = get_review_forecast(all_q, days=30)
        return jsonify(forecast)
