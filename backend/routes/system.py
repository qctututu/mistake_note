import os
import uuid

from flask import request, jsonify, send_from_directory

from repository.database import get_stats


def register_system_routes(app, upload_folder, allowed_image_ext):
    @app.route('/api/stats', methods=['GET'])
    def api_stats():
        return jsonify(get_stats())

    @app.route('/api/upload-image', methods=['POST'])
    def api_upload_image():
        if 'image' not in request.files:
            return jsonify({'error': '未上传文件'}), 400
        f = request.files['image']
        if f.filename == '':
            return jsonify({'error': '文件名为空'}), 400

        ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
        if ext not in allowed_image_ext:
            supported = ', '.join(sorted(allowed_image_ext))
            return jsonify({'error': f'不支持的文件类型，仅支持: {supported}'}), 400

        filename = f'{uuid.uuid4().hex}.{ext}'
        f.save(os.path.join(upload_folder, filename))

        port = int(os.environ.get('PORT', 5000))
        url = f'http://localhost:{port}/uploads/images/{filename}'
        return jsonify({'url': url, 'filename': filename}), 201

    @app.route('/uploads/images/<path:filename>')
    def serve_uploaded_image(filename):
        return send_from_directory(upload_folder, filename)

    @app.route('/api/health', methods=['GET'])
    def api_health():
        return jsonify({'status': 'ok', 'version': '1.0.0'})
