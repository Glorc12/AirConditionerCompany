# services/auth_service.py

import jwt
import datetime
from models.user import User
from database import db
from config import Config

class AuthService:
    SECRET_KEY = 'your-secret-key-change-in-production'  # ВАЖНО: Измени на боевом сервере!
    ALGORITHM = 'HS256'
    
    @staticmethod
    def login_user(login: str, password: str):
        """Проверка логина и пароля, создание токена"""
        try:
            user = User.query.filter_by(login=login, password=password).first()
            
            if not user:
                return {'error': 'Invalid login or password'}, 401
            
            # Создание JWT токена
            token = AuthService.generate_token(user)
            
            return {
                'access_token': token,
                'user': {
                    'user_id': user.user_id,
                    'full_name': user.full_name,
                    'login': user.login,
                    'user_type': user.user_type,
                    'phone': user.phone
                },
                'message': 'Login successful'
            }, 200
            
        except Exception as e:
            return {'error': str(e)}, 500
    
    @staticmethod
    def generate_token(user):
        """Генерация JWT токена"""
        payload = {
            'user_id': user.user_id,
            'login': user.login,
            'user_type': user.user_type,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24),
            'iat': datetime.datetime.utcnow()
        }
        
        token = jwt.encode(payload, AuthService.SECRET_KEY, algorithm=AuthService.ALGORITHM)
        return token
    
    @staticmethod
    def verify_token(token: str):
        """Проверка и декодирование токена"""
        try:
            payload = jwt.decode(token, AuthService.SECRET_KEY, algorithms=[AuthService.ALGORITHM])
            return payload, None
        except jwt.ExpiredSignatureError:
            return None, 'Token expired'
        except jwt.InvalidTokenError:
            return None, 'Invalid token'
    
    @staticmethod
    def get_current_user(token: str):
        """Получение текущего пользователя из токена"""
        payload, error = AuthService.verify_token(token)
        
        if error:
            return None, error
        
        user = User.query.get(payload['user_id'])
        
        if not user:
            return None, 'User not found'
        
        return user, None
