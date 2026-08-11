from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

GuessDifficulty = Literal["easy", "medium", "hard"]
GuessQuestionState = Literal["draft", "published", "disabled"]


class GuessOptionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: UUID
    name: str


class GuessQuestionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: UUID
    image_url: str
    image_alt: str
    difficulty: GuessDifficulty
    options: list[GuessOptionRead]


class GuessAnswerCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: UUID
    selected_panda_id: UUID


class GuessAnswerPandaRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: UUID
    name: str
    slug: str


class GuessAnswerRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    correct: bool
    answer: GuessAnswerPandaRead
    recognition_tips: list[str]


class AdminGuessQuestionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: UUID
    media_id: str = Field(min_length=1, max_length=200)
    difficulty: GuessDifficulty
    option_panda_ids: list[UUID] = Field(min_length=4, max_length=4)
    recognition_tips: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_options(self) -> AdminGuessQuestionInput:
        if len(set(self.option_panda_ids)) != 4:
            raise ValueError("Guess Panda options must contain four distinct pandas")
        if self.panda_id not in self.option_panda_ids:
            raise ValueError("Guess Panda options must include the answer panda")
        if any(not tip.strip() or len(tip.strip()) > 300 for tip in self.recognition_tips):
            raise ValueError("recognition tips must contain 1-300 characters")
        self.recognition_tips = [tip.strip() for tip in self.recognition_tips]
        return self


class AdminGuessQuestionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: UUID
    panda_id: UUID
    panda_name: str
    panda_slug: str
    media_id: str
    image_url: str | None
    difficulty: GuessDifficulty
    option_panda_ids: list[UUID]
    option_names: list[str]
    recognition_tips: list[str]
    state: GuessQuestionState
    attempt_count: int
    correct_count: int
    accuracy: float | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class AdminGuessQuestionListRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AdminGuessQuestionRead]
    total: int
    page: int
    page_size: int
