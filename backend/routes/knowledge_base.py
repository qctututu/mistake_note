from flask import request, jsonify

from services.knowledge_base import (
    init_kb,
    upload_file as kb_upload,
    list_files as kb_list_files,
    delete_file as kb_delete_file,
    search_knowledge,
)


def register_kb_routes(app):
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
