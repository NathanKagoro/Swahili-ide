from fastapi import APIRouter

from app.models.request_models import SwahiliRunRequest, SwahiliRunResponse
from app.services.swahili_service import run_swahili_code

router = APIRouter()


@router.post("/run-swahili", response_model=SwahiliRunResponse)
def run_swahili(payload: SwahiliRunRequest) -> SwahiliRunResponse:
    output, error = run_swahili_code(payload.code)
    return SwahiliRunResponse(output=output, error=error)
