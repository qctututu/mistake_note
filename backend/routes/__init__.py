from .subjects import register_subject_routes
from .questions import register_question_routes
from .review import register_review_routes
from .ai import register_ai_routes
from .knowledge_base import register_kb_routes
from .practice import register_practice_routes
from .system import register_system_routes


def register_all_routes(app, logger, upload_folder, allowed_image_ext):
    register_subject_routes(app)
    register_question_routes(app, logger, upload_folder, allowed_image_ext)
    register_review_routes(app)
    register_ai_routes(app)
    register_kb_routes(app)
    register_practice_routes(app)
    register_system_routes(app, upload_folder, allowed_image_ext)
