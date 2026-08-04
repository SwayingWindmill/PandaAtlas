from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.identity.models import RequestIdentity
from app.identity.security import require_capability
from app.review_moderation.public import (
    ClaimReviewCaseCommand,
    DecideReviewCaseCommand,
    IntakeReviewCaseCommand,
    RecommendAssertionsCommand,
    ReopenReviewCaseCommand,
    RequestInformationCommand,
    ReviewCaseDetail,
    ReviewCaseList,
    ReviewMetricsRead,
    ReviewQueue,
    TriageReviewCaseCommand,
    VerifySourceCommand,
    claim_review_case,
    decide_review_case,
    get_review_case,
    intake_submission,
    list_review_cases,
    recommend_assertions,
    reopen_review_case,
    request_information,
    review_metrics,
    triage_review_case,
    verify_source,
)

router = APIRouter(prefix="/admin")

ReviewReader = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.read")),
]
ReviewIntakeOperator = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.intake")),
]
ReviewTriageOperator = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.triage")),
]
ReviewClaimer = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.claim")),
]
InformationRequester = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.request_information")),
]
SourceVerifier = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.verify_source")),
]
ReviewDecider = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.decide")),
]
CurationRecommender = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.recommend")),
]
ReviewReopener = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.reopen")),
]
ReviewMetricsReader = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.metrics")),
]
ReviewQueueParameter = Annotated[ReviewQueue, Query()]
ReviewLimitParameter = Annotated[int, Query(ge=1, le=100)]


@router.get("/review-cases", response_model=ReviewCaseList)
def list_review_cases_endpoint(
    identity: ReviewReader,
    queue: ReviewQueueParameter = ReviewQueue.ALL,
    limit: ReviewLimitParameter = 50,
) -> ReviewCaseList:
    _ = identity
    return list_review_cases(queue, limit)


@router.post(
    "/review-cases/intake/{submission_id}",
    response_model=ReviewCaseDetail,
    status_code=status.HTTP_201_CREATED,
)
def intake_submission_endpoint(
    submission_id: UUID,
    command: IntakeReviewCaseCommand,
    identity: ReviewIntakeOperator,
) -> ReviewCaseDetail:
    return intake_submission(submission_id, command, identity.account_id)


@router.get("/review-cases/{review_case_id}", response_model=ReviewCaseDetail)
def get_review_case_endpoint(
    review_case_id: UUID,
    identity: ReviewReader,
) -> ReviewCaseDetail:
    _ = identity
    return get_review_case(review_case_id)


@router.post("/review-cases/{review_case_id}/triage", response_model=ReviewCaseDetail)
def triage_review_case_endpoint(
    review_case_id: UUID,
    command: TriageReviewCaseCommand,
    identity: ReviewTriageOperator,
) -> ReviewCaseDetail:
    return triage_review_case(review_case_id, command, identity.account_id)


@router.post("/review-cases/{review_case_id}/claim", response_model=ReviewCaseDetail)
def claim_review_case_endpoint(
    review_case_id: UUID,
    command: ClaimReviewCaseCommand,
    identity: ReviewClaimer,
) -> ReviewCaseDetail:
    return claim_review_case(review_case_id, command, identity.account_id)


@router.post(
    "/review-cases/{review_case_id}/request-information",
    response_model=ReviewCaseDetail,
)
def request_information_endpoint(
    review_case_id: UUID,
    command: RequestInformationCommand,
    identity: InformationRequester,
) -> ReviewCaseDetail:
    return request_information(review_case_id, command, identity.account_id)


@router.post(
    "/review-cases/{review_case_id}/sources/{source_id}/verify",
    response_model=ReviewCaseDetail,
)
def verify_source_endpoint(
    review_case_id: UUID,
    source_id: UUID,
    command: VerifySourceCommand,
    identity: SourceVerifier,
) -> ReviewCaseDetail:
    return verify_source(review_case_id, source_id, command, identity.account_id)


@router.post("/review-cases/{review_case_id}/decide", response_model=ReviewCaseDetail)
def decide_review_case_endpoint(
    review_case_id: UUID,
    command: DecideReviewCaseCommand,
    identity: ReviewDecider,
) -> ReviewCaseDetail:
    return decide_review_case(review_case_id, command, identity.account_id)


@router.post("/review-cases/{review_case_id}/recommend", response_model=ReviewCaseDetail)
def recommend_assertions_endpoint(
    review_case_id: UUID,
    command: RecommendAssertionsCommand,
    identity: CurationRecommender,
) -> ReviewCaseDetail:
    return recommend_assertions(review_case_id, command, identity.account_id)


@router.post(
    "/review-cases/{review_case_id}/reopen",
    response_model=ReviewCaseDetail,
    status_code=status.HTTP_201_CREATED,
)
def reopen_review_case_endpoint(
    review_case_id: UUID,
    command: ReopenReviewCaseCommand,
    identity: ReviewReopener,
) -> ReviewCaseDetail:
    return reopen_review_case(review_case_id, command, identity.account_id)


@router.get("/review-metrics", response_model=ReviewMetricsRead)
def review_metrics_endpoint(identity: ReviewMetricsReader) -> ReviewMetricsRead:
    _ = identity
    return review_metrics()
