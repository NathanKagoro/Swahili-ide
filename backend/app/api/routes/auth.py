from fastapi import APIRouter, Header, HTTPException, status

from app.models.request_models import (
    AuthRequest,
    AuthResponse,
    ProgressResponse,
    ProgressUpdateRequest,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_session,
    create_user,
    delete_session,
    get_progress,
    get_user_by_token,
    save_progress,
)

router = APIRouter()


def get_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing bearer token.')
    return authorization.replace('Bearer ', '', 1).strip()


@router.post('/auth/register', response_model=AuthResponse)
def register(payload: AuthRequest) -> AuthResponse:
    user = create_user(payload.username, payload.password)
    token = create_session(user['id'])
    completed_lessons = get_progress(user['id'])
    return AuthResponse(token=token, user=UserResponse(**user), completed_lessons=completed_lessons)


@router.post('/auth/login', response_model=AuthResponse)
def login(payload: AuthRequest) -> AuthResponse:
    user = authenticate_user(payload.username, payload.password)
    token = create_session(user['id'])
    completed_lessons = get_progress(user['id'])
    return AuthResponse(token=token, user=UserResponse(**user), completed_lessons=completed_lessons)


@router.post('/auth/logout')
def logout(authorization: str | None = Header(default=None)) -> dict[str, str]:
    token = get_bearer_token(authorization)
    delete_session(token)
    return {'status': 'ok'}


@router.get('/auth/me', response_model=UserResponse)
def me(authorization: str | None = Header(default=None)) -> UserResponse:
    token = get_bearer_token(authorization)
    user = get_user_by_token(token)
    return UserResponse(**user)


@router.get('/progress', response_model=ProgressResponse)
def read_progress(authorization: str | None = Header(default=None)) -> ProgressResponse:
    token = get_bearer_token(authorization)
    user = get_user_by_token(token)
    return ProgressResponse(completed_lessons=get_progress(user['id']))


@router.put('/progress', response_model=ProgressResponse)
def update_progress(payload: ProgressUpdateRequest, authorization: str | None = Header(default=None)) -> ProgressResponse:
    token = get_bearer_token(authorization)
    user = get_user_by_token(token)
    completed_lessons = save_progress(user['id'], payload.completed_lessons)
    return ProgressResponse(completed_lessons=completed_lessons)
