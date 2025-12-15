from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from database import init_db

def create_app():
    app = Flask(__name__, static_folder='frontend', static_url_path='')

    # конфиг
    app.config.from_object('config.Config')

    # инициализация БД
    init_db(app)

    # Enable CORS
    CORS(app)

    # Import and register blueprints
    from routes.auth import auth_bp
    from routes.users import users_bp
    from routes.requests import requests_bp
    from routes.statistics import statistics_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(requests_bp)
    app.register_blueprint(statistics_bp)

    # Serve static files
    @app.route('/')
    @app.route('/index.html')
    def index():
        return send_from_directory('frontend', 'index.html')

    @app.route('/<path:path>')
    def catch_all(path):
        if path.startswith('api/'):
            return {'error': 'Not found'}, 404
        if os.path.exists(f'frontend/{path}'):
            return send_from_directory('frontend', path)
        return send_from_directory('frontend', 'index.html')

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='192.168.0.21', port=5000, debug=True)
