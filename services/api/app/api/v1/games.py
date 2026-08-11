from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import session_scope
from app.games.guess_repository import GuessPandaRepository
from app.games.models import GuessAnswerCommand, GuessAnswerRead, GuessDifficulty, GuessQuestionRead

router = APIRouter(prefix="/games/guess")


def _database_unavailable(error: SQLAlchemyError) -> HTTPException:
    return HTTPException(status_code=503, detail={"code": "game_database_unavailable"})


@router.get("/question", response_model=GuessQuestionRead)
def guess_panda_question(
    difficulty: Annotated[GuessDifficulty | None, Query()] = None,
) -> GuessQuestionRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail={"code": "game_database_unavailable"})
            return GuessPandaRepository(session).public_question(difficulty)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/answer", response_model=GuessAnswerRead)
def answer_guess_panda(command: GuessAnswerCommand) -> GuessAnswerRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail={"code": "game_database_unavailable"})
            return GuessPandaRepository(session).answer(command)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error
