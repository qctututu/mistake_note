from flask import request, jsonify

from repository.database import get_subjects, add_subject


def register_subject_routes(app):
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
