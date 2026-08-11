from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import session_scope
from app.games.guess_repository import GuessPandaRepository
from app.games.models import (
    AdminGuessQuestionInput,
    AdminGuessQuestionListRead,
    AdminGuessQuestionRead,
    GuessDifficulty,
    GuessQuestionState,
)
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin/games/guess/questions")

QuestionReader = Annotated[
    RequestIdentity,
    Depends(require_capability("game.question.read")),
]
QuestionEditor = Annotated[
    RequestIdentity,
    Depends(require_capability("game.question.edit")),
]
QuestionPublisher = Annotated[
    RequestIdentity,
    Depends(require_capability("game.question.publish", recent_auth=True)),
]


def _database_unavailable(error: SQLAlchemyError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "admin_game_database_unavailable"},
    )


def _require_session(session: object | None) -> None:
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "admin_game_database_unavailable"},
        )


@router.get("", response_model=AdminGuessQuestionListRead)
def list_guess_questions(
    identity: QuestionReader,
    q: Annotated[str | None, Query(max_length=200)] = None,
    difficulty: Annotated[GuessDifficulty | None, Query()] = None,
    state: Annotated[GuessQuestionState | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminGuessQuestionListRead:
    _ = identity
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return GuessPandaRepository(session).list_admin(
                query=q,
                difficulty=difficulty,
                state=state,
                page=page,
                page_size=page_size,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("", response_model=AdminGuessQuestionRead, status_code=status.HTTP_201_CREATED)
def create_guess_question(
    payload: AdminGuessQuestionInput,
    identity: QuestionEditor,
) -> AdminGuessQuestionRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return GuessPandaRepository(session).create(payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.patch("/{question_id}", response_model=AdminGuessQuestionRead)
def update_guess_question(
    question_id: UUID,
    payload: AdminGuessQuestionInput,
    identity: QuestionEditor,
) -> AdminGuessQuestionRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return GuessPandaRepository(session).update(question_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/{question_id}/publish", response_model=AdminGuessQuestionRead)
def publish_guess_question(
    question_id: UUID,
    identity: QuestionPublisher,
) -> AdminGuessQuestionRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return GuessPandaRepository(session).publish(question_id, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/{question_id}/disable", response_model=AdminGuessQuestionRead)
def disable_guess_question(
    question_id: UUID,
    identity: QuestionPublisher,
) -> AdminGuessQuestionRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return GuessPandaRepository(session).disable(question_id, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error
