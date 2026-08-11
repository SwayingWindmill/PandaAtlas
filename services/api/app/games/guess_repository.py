from __future__ import annotations

import json
import random
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.games.models import (
    AdminGuessQuestionInput,
    AdminGuessQuestionListRead,
    AdminGuessQuestionRead,
    GuessAnswerCommand,
    GuessAnswerPandaRead,
    GuessAnswerRead,
    GuessDifficulty,
    GuessOptionRead,
    GuessQuestionRead,
    GuessQuestionState,
)
from app.identity.models import RequestIdentity
from app.services.managed_release_service import get_current_api_release


class GuessPandaRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def _release_index() -> dict[str, dict[str, Any]]:
        payload = get_current_api_release()
        return {
            str(item["id"]): item
            for item in payload.get("pandas", [])
            if isinstance(item, dict) and item.get("id")
        }

    @staticmethod
    def _name(panda: dict[str, Any]) -> str:
        return str(panda.get("name_zh") or panda.get("name_en") or panda.get("slug") or panda["id"])

    @staticmethod
    def _media(panda: dict[str, Any], media_id: str) -> dict[str, Any] | None:
        for media in panda.get("media", []):
            if not isinstance(media, dict):
                continue
            if str(media.get("id")) != media_id or media.get("status") != "available":
                continue
            if media.get("url"):
                return media
        return None

    def _validate_input(
        self,
        payload: AdminGuessQuestionInput,
    ) -> tuple[dict[str, dict[str, Any]], dict[str, Any], dict[str, Any]]:
        pandas = self._release_index()
        missing = [
            str(panda_id)
            for panda_id in payload.option_panda_ids
            if str(panda_id) not in pandas
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail={"code": "GAME_OPTION_NOT_PUBLISHED", "panda_ids": missing},
            )
        answer = pandas.get(str(payload.panda_id))
        if answer is None:
            raise HTTPException(status_code=422, detail={"code": "GAME_ANSWER_NOT_PUBLISHED"})
        media = self._media(answer, payload.media_id)
        if media is None:
            raise HTTPException(
                status_code=422,
                detail={"code": "GAME_MEDIA_NOT_PUBLISHED", "media_id": payload.media_id},
            )
        return pandas, answer, media

    def _row_read(
        self,
        row: dict[str, Any],
        pandas: dict[str, dict[str, Any]],
    ) -> AdminGuessQuestionRead:
        panda_id = str(row["panda_id"])
        answer = pandas.get(panda_id)
        option_ids = [UUID(str(value)) for value in row["option_panda_ids"]]
        option_names = [
            self._name(pandas[str(value)]) if str(value) in pandas else str(value)
            for value in option_ids
        ]
        media = self._media(answer, str(row["media_id"])) if answer else None
        attempts = int(row["attempt_count"])
        correct = int(row["correct_count"])
        return AdminGuessQuestionRead(
            question_id=UUID(str(row["question_id"])),
            panda_id=UUID(panda_id),
            panda_name=self._name(answer) if answer else panda_id,
            panda_slug=str(answer.get("slug")) if answer else "",
            media_id=str(row["media_id"]),
            image_url=str(media["url"]) if media else None,
            difficulty=str(row["difficulty"]),
            option_panda_ids=option_ids,
            option_names=option_names,
            recognition_tips=[str(value) for value in row["recognition_tips"]],
            state=str(row["state"]),
            attempt_count=attempts,
            correct_count=correct,
            accuracy=(correct / attempts if attempts else None),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            published_at=row["published_at"],
        )

    def list_admin(
        self,
        *,
        query: str | None,
        difficulty: GuessDifficulty | None,
        state: GuessQuestionState | None,
        page: int,
        page_size: int,
    ) -> AdminGuessQuestionListRead:
        rows = [
            dict(row)
            for row in self.session.execute(
                text(
                    """
                    select question_id, panda_id, media_id, difficulty, option_panda_ids,
                           recognition_tips, state, attempt_count, correct_count,
                           created_at, updated_at, published_at
                    from game.guess_questions
                    where (
                      cast(:difficulty as text) is null
                      or difficulty = cast(:difficulty as text)
                    ) and (
                      cast(:state as text) is null
                      or state = cast(:state as text)
                    )
                    order by updated_at desc, question_id
                    """
                ),
                {"difficulty": difficulty, "state": state},
            ).mappings()
        ]
        pandas = self._release_index()
        items = [self._row_read(row, pandas) for row in rows]
        if query:
            needle = query.strip().casefold()
            items = [
                item
                for item in items
                if needle in item.panda_name.casefold()
                or needle in item.panda_slug.casefold()
                or needle in item.media_id.casefold()
                or needle in str(item.question_id).casefold()
            ]
        total = len(items)
        start = (page - 1) * page_size
        return AdminGuessQuestionListRead(
            items=items[start : start + page_size],
            total=total,
            page=page,
            page_size=page_size,
        )

    def create(
        self,
        payload: AdminGuessQuestionInput,
        identity: RequestIdentity,
    ) -> AdminGuessQuestionRead:
        pandas, _answer, _media = self._validate_input(payload)
        try:
            row = self.session.execute(
                text(
                    """
                    insert into game.guess_questions (
                      panda_id, media_id, difficulty, option_panda_ids,
                      recognition_tips, created_by, updated_by
                    ) values (
                      :panda_id, :media_id, :difficulty, :option_panda_ids,
                      cast(:recognition_tips as jsonb), :actor_id, :actor_id
                    )
                    returning question_id, panda_id, media_id, difficulty, option_panda_ids,
                              recognition_tips, state, attempt_count, correct_count,
                              created_at, updated_at, published_at
                    """
                ),
                {
                    "panda_id": payload.panda_id,
                    "media_id": payload.media_id,
                    "difficulty": payload.difficulty,
                    "option_panda_ids": payload.option_panda_ids,
                    "recognition_tips": json.dumps(payload.recognition_tips, ensure_ascii=False),
                    "actor_id": identity.account_id,
                },
            ).mappings().one()
            self._audit("admin.game_question.created", str(row["question_id"]), identity)
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise HTTPException(status_code=409, detail={"code": "GAME_QUESTION_EXISTS"}) from error
        return self._row_read(dict(row), pandas)

    def update(
        self,
        question_id: UUID,
        payload: AdminGuessQuestionInput,
        identity: RequestIdentity,
    ) -> AdminGuessQuestionRead:
        pandas, _answer, _media = self._validate_input(payload)
        row = self.session.execute(
            text(
                """
                update game.guess_questions
                set panda_id = :panda_id,
                    media_id = :media_id,
                    difficulty = :difficulty,
                    option_panda_ids = :option_panda_ids,
                    recognition_tips = cast(:recognition_tips as jsonb),
                    state = 'draft', published_at = null,
                    updated_by = :actor_id, updated_at = now()
                where question_id = :question_id
                  and state <> 'disabled'
                returning question_id, panda_id, media_id, difficulty, option_panda_ids,
                          recognition_tips, state, attempt_count, correct_count,
                          created_at, updated_at, published_at
                """
            ),
            {
                "question_id": question_id,
                "panda_id": payload.panda_id,
                "media_id": payload.media_id,
                "difficulty": payload.difficulty,
                "option_panda_ids": payload.option_panda_ids,
                "recognition_tips": json.dumps(payload.recognition_tips, ensure_ascii=False),
                "actor_id": identity.account_id,
            },
        ).mappings().one_or_none()
        if row is None:
            self.session.rollback()
            raise HTTPException(status_code=409, detail={"code": "GAME_QUESTION_NOT_EDITABLE"})
        self._audit("admin.game_question.updated", str(question_id), identity)
        self.session.commit()
        return self._row_read(dict(row), pandas)

    def publish(self, question_id: UUID, identity: RequestIdentity) -> AdminGuessQuestionRead:
        current = self._question_row(question_id)
        payload = AdminGuessQuestionInput(
            panda_id=UUID(str(current["panda_id"])),
            media_id=str(current["media_id"]),
            difficulty=str(current["difficulty"]),
            option_panda_ids=[UUID(str(value)) for value in current["option_panda_ids"]],
            recognition_tips=[str(value) for value in current["recognition_tips"]],
        )
        pandas, _answer, _media = self._validate_input(payload)
        row = self.session.execute(
            text(
                """
                update game.guess_questions
                set state = 'published', published_at = coalesce(published_at, now()),
                    updated_by = :actor_id, updated_at = now()
                where question_id = :question_id and state in ('draft', 'published')
                returning question_id, panda_id, media_id, difficulty, option_panda_ids,
                          recognition_tips, state, attempt_count, correct_count,
                          created_at, updated_at, published_at
                """
            ),
            {"question_id": question_id, "actor_id": identity.account_id},
        ).mappings().one_or_none()
        if row is None:
            self.session.rollback()
            raise HTTPException(status_code=409, detail={"code": "GAME_QUESTION_NOT_PUBLISHABLE"})
        self._audit("admin.game_question.published", str(question_id), identity)
        self.session.commit()
        return self._row_read(dict(row), pandas)

    def disable(self, question_id: UUID, identity: RequestIdentity) -> AdminGuessQuestionRead:
        pandas = self._release_index()
        row = self.session.execute(
            text(
                """
                update game.guess_questions
                set state = 'disabled', updated_by = :actor_id, updated_at = now()
                where question_id = :question_id and state <> 'disabled'
                returning question_id, panda_id, media_id, difficulty, option_panda_ids,
                          recognition_tips, state, attempt_count, correct_count,
                          created_at, updated_at, published_at
                """
            ),
            {"question_id": question_id, "actor_id": identity.account_id},
        ).mappings().one_or_none()
        if row is None:
            self.session.rollback()
            raise HTTPException(status_code=409, detail={"code": "GAME_QUESTION_ALREADY_DISABLED"})
        self._audit("admin.game_question.disabled", str(question_id), identity)
        self.session.commit()
        return self._row_read(dict(row), pandas)

    def public_question(self, difficulty: GuessDifficulty | None) -> GuessQuestionRead:
        rows = [
            dict(row)
            for row in self.session.execute(
                text(
                    """
                    select question_id, panda_id, media_id, difficulty, option_panda_ids
                    from game.guess_questions
                    where state = 'published'
                      and (
                        cast(:difficulty as text) is null
                        or difficulty = cast(:difficulty as text)
                      )
                    """
                ),
                {"difficulty": difficulty},
            ).mappings()
        ]
        random.shuffle(rows)
        pandas = self._release_index()
        for row in rows:
            answer = pandas.get(str(row["panda_id"]))
            media = self._media(answer, str(row["media_id"])) if answer else None
            option_ids = [str(value) for value in row["option_panda_ids"]]
            if media is None or any(value not in pandas for value in option_ids):
                continue
            return GuessQuestionRead(
                question_id=UUID(str(row["question_id"])),
                image_url=str(media["url"]),
                image_alt=str(media.get("alt_zh") or media.get("alt_en") or "Guess Panda image"),
                difficulty=str(row["difficulty"]),
                options=[
                    GuessOptionRead(panda_id=UUID(value), name=self._name(pandas[value]))
                    for value in option_ids
                ],
            )
        raise HTTPException(status_code=404, detail={"code": "GAME_QUESTION_NOT_FOUND"})

    def answer(self, command: GuessAnswerCommand) -> GuessAnswerRead:
        row = self.session.execute(
            text(
                """
                select question_id, panda_id, option_panda_ids, recognition_tips
                from game.guess_questions
                where question_id = :question_id and state = 'published'
                for update
                """
            ),
            {"question_id": command.question_id},
        ).mappings().one_or_none()
        if row is None:
            self.session.rollback()
            raise HTTPException(status_code=404, detail={"code": "GAME_QUESTION_NOT_FOUND"})
        options = {UUID(str(value)) for value in row["option_panda_ids"]}
        if command.selected_panda_id not in options:
            self.session.rollback()
            raise HTTPException(status_code=422, detail={"code": "INVALID_GAME_OPTION"})
        answer_id = UUID(str(row["panda_id"]))
        correct = command.selected_panda_id == answer_id
        self.session.execute(
            text(
                """
                update game.guess_questions
                set attempt_count = attempt_count + 1,
                    correct_count = correct_count + :correct_increment
                where question_id = :question_id
                """
            ),
            {"question_id": command.question_id, "correct_increment": 1 if correct else 0},
        )
        pandas = self._release_index()
        answer = pandas.get(str(answer_id))
        if answer is None:
            self.session.rollback()
            raise HTTPException(status_code=409, detail={"code": "GAME_QUESTION_DISABLED"})
        self.session.commit()
        return GuessAnswerRead(
            correct=correct,
            answer=GuessAnswerPandaRead(
                panda_id=answer_id,
                name=self._name(answer),
                slug=str(answer["slug"]),
            ),
            recognition_tips=[str(value) for value in row["recognition_tips"]],
        )

    def _question_row(self, question_id: UUID) -> dict[str, Any]:
        row = self.session.execute(
            text(
                """
                select question_id, panda_id, media_id, difficulty, option_panda_ids,
                       recognition_tips, state, attempt_count, correct_count,
                       created_at, updated_at, published_at
                from game.guess_questions
                where question_id = :question_id
                for update
                """
            ),
            {"question_id": question_id},
        ).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "GAME_QUESTION_NOT_FOUND"})
        return dict(row)

    def _audit(self, event_type: str, question_id: str, identity: RequestIdentity) -> None:
        self.session.execute(
            text(
                """
                insert into public.audit_events (
                  event_type, subject_type, subject_id, actor_id, reason, metadata
                ) values (
                  :event_type, 'guess_question', :question_id, :actor_id,
                  :reason, cast(:metadata as jsonb)
                )
                """
            ),
            {
                "event_type": event_type,
                "question_id": question_id,
                "actor_id": identity.account_id,
                "reason": event_type.replace("admin.game_question.", "Guess Panda question "),
                "metadata": json.dumps({"question_id": question_id}),
            },
        )
