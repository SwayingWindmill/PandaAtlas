import type { components } from "@zhipanda/api-client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type OpenReviewCaseBody = components["schemas"]["OpenReviewCaseDto"];
type VerifyReviewSourceBody = components["schemas"]["VerifyReviewSourceDto"];
type ReviewDecisionBody = components["schemas"]["RecordReviewDecisionDto"];
type ReviewRecommendBody = components["schemas"]["RecommendReviewDto"];
type ApplySanctionBody = components["schemas"]["ApplySanctionDto"];
type RestoreSanctionBody = components["schemas"]["RestoreSanctionDto"];
type DecideAppealBody = components["schemas"]["DecideAppealDto"];
type ApproveCurationBody = components["schemas"]["ApproveCurationDto"];
type BuildReleaseBody = components["schemas"]["BuildPublicReleaseDto"];
type PublicationReasonBody = components["schemas"]["PublicationReasonDto"];
type PublicationResourceBody = components["schemas"]["PublicationResourceControlDto"];

interface AdminOperationRequest {
  operation: string;
  resourceId?: string;
  payload?: unknown;
}

function requiredResourceId(value: string | undefined): string | NextResponse {
  if (!value?.trim()) {
    return NextResponse.json({ detail: "resourceId is required" }, { status: 400 });
  }
  return value.trim();
}

function objectPayload(value: unknown): Record<string, unknown> | NextResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return NextResponse.json({ detail: "payload must be a JSON object" }, { status: 400 });
  }
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const input = await request.json().catch(() => null) as AdminOperationRequest | null;
  if (!input?.operation) {
    return NextResponse.json({ detail: "operation is required" }, { status: 400 });
  }

  switch (input.operation) {
    case "review.open": {
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/review/cases", {
        headers: api.headers,
        body: payload as OpenReviewCaseBody,
      }));
    }
    case "review.get": {
      const reviewCaseId = requiredResourceId(input.resourceId);
      if (reviewCaseId instanceof NextResponse) return reviewCaseId;
      return v2JsonResponse(await api.client.GET("/api/v2/review/cases/{reviewCaseId}", {
        headers: api.headers,
        params: { path: { reviewCaseId } },
      }));
    }
    case "review.claim": {
      const reviewCaseId = requiredResourceId(input.resourceId);
      if (reviewCaseId instanceof NextResponse) return reviewCaseId;
      return v2JsonResponse(await api.client.POST("/api/v2/review/cases/{reviewCaseId}/claim", {
        headers: api.headers,
        params: { path: { reviewCaseId } },
      }));
    }
    case "review.verifySource": {
      const reviewCaseId = requiredResourceId(input.resourceId);
      if (reviewCaseId instanceof NextResponse) return reviewCaseId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/review/cases/{reviewCaseId}/source-verifications", {
        headers: api.headers,
        params: { path: { reviewCaseId } },
        body: payload as VerifyReviewSourceBody,
      }));
    }
    case "review.decide": {
      const reviewCaseId = requiredResourceId(input.resourceId);
      if (reviewCaseId instanceof NextResponse) return reviewCaseId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/review/cases/{reviewCaseId}/decision", {
        headers: api.headers,
        params: { path: { reviewCaseId } },
        body: payload as ReviewDecisionBody,
      }));
    }
    case "review.recommend": {
      const reviewCaseId = requiredResourceId(input.resourceId);
      if (reviewCaseId instanceof NextResponse) return reviewCaseId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/review/cases/{reviewCaseId}/recommend", {
        headers: api.headers,
        params: { path: { reviewCaseId } },
        body: payload as ReviewRecommendBody,
      }));
    }
    case "moderation.getAccount": {
      const accountId = requiredResourceId(input.resourceId);
      if (accountId instanceof NextResponse) return accountId;
      return v2JsonResponse(await api.client.GET("/api/v2/moderation/accounts/{accountId}", {
        headers: api.headers,
        params: { path: { accountId } },
      }));
    }
    case "moderation.applySanction": {
      const accountId = requiredResourceId(input.resourceId);
      if (accountId instanceof NextResponse) return accountId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/moderation/accounts/{accountId}/sanctions", {
        headers: api.headers,
        params: { path: { accountId } },
        body: payload as ApplySanctionBody,
      }));
    }
    case "moderation.restoreSanction": {
      const sanctionId = requiredResourceId(input.resourceId);
      if (sanctionId instanceof NextResponse) return sanctionId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/moderation/sanctions/{sanctionId}/restore", {
        headers: api.headers,
        params: { path: { sanctionId } },
        body: payload as RestoreSanctionBody,
      }));
    }
    case "moderation.decideAppeal": {
      const appealCaseId = requiredResourceId(input.resourceId);
      if (appealCaseId instanceof NextResponse) return appealCaseId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/moderation/appeals/{appealCaseId}/decision", {
        headers: api.headers,
        params: { path: { appealCaseId } },
        body: payload as DecideAppealBody,
      }));
    }
    case "curation.get": {
      const changeSetId = requiredResourceId(input.resourceId);
      if (changeSetId instanceof NextResponse) return changeSetId;
      return v2JsonResponse(await api.client.GET("/api/v2/curation/change-sets/{changeSetId}", {
        headers: api.headers,
        params: { path: { changeSetId } },
      }));
    }
    case "curation.validate": {
      const changeSetId = requiredResourceId(input.resourceId);
      if (changeSetId instanceof NextResponse) return changeSetId;
      return v2JsonResponse(await api.client.POST("/api/v2/curation/change-sets/{changeSetId}/validate", {
        headers: api.headers,
        params: { path: { changeSetId } },
      }));
    }
    case "curation.approve": {
      const changeSetId = requiredResourceId(input.resourceId);
      if (changeSetId instanceof NextResponse) return changeSetId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/curation/change-sets/{changeSetId}/approve", {
        headers: api.headers,
        params: { path: { changeSetId } },
        body: payload as ApproveCurationBody,
      }));
    }
    case "publication.getRelease": {
      const releaseId = requiredResourceId(input.resourceId);
      if (releaseId instanceof NextResponse) return releaseId;
      return v2JsonResponse(await api.client.GET("/api/v2/publication/releases/{releaseId}", {
        headers: api.headers,
        params: { path: { releaseId } },
      }));
    }
    case "publication.build": {
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases", {
        headers: api.headers,
        body: payload as BuildReleaseBody,
      }));
    }
    case "publication.seal":
    case "publication.activate":
    case "publication.rollback":
    case "publication.suspend":
    case "publication.restore": {
      const releaseId = requiredResourceId(input.resourceId);
      if (releaseId instanceof NextResponse) return releaseId;
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      const body = payload as PublicationReasonBody;
      if (input.operation === "publication.seal") {
        return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/seal", {
          headers: api.headers,
          params: { path: { releaseId } },
          body,
        }));
      }
      if (input.operation === "publication.activate") {
        return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/activate", {
          headers: api.headers,
          params: { path: { releaseId } },
          body,
        }));
      }
      if (input.operation === "publication.rollback") {
        return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/rollback", {
          headers: api.headers,
          params: { path: { releaseId } },
          body,
        }));
      }
      if (input.operation === "publication.suspend") {
        return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/suspend", {
          headers: api.headers,
          params: { path: { releaseId } },
          body,
        }));
      }
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/restore", {
        headers: api.headers,
        params: { path: { releaseId } },
        body,
      }));
    }
    case "publication.takeDownResource":
    case "publication.restoreResource": {
      const payload = objectPayload(input.payload);
      if (payload instanceof NextResponse) return payload;
      const body = payload as PublicationResourceBody;
      return input.operation === "publication.takeDownResource"
        ? v2JsonResponse(await api.client.POST("/api/v2/publication/resources/takedown", {
            headers: api.headers,
            body,
          }))
        : v2JsonResponse(await api.client.POST("/api/v2/publication/resources/restore", {
            headers: api.headers,
            body,
          }));
    }
    case "audit.list": {
      const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? input.payload as { limit?: unknown }
        : {};
      const rawLimit = typeof payload.limit === "number" ? payload.limit : 50;
      const limit = Math.max(1, Math.min(200, Math.trunc(rawLimit)));
      return v2JsonResponse(await api.client.GET("/api/v2/audit/evidence", {
        headers: api.headers,
        params: { query: { limit } },
      }));
    }
    default:
      return NextResponse.json({ detail: "Unsupported admin V2 operation" }, { status: 404 });
  }
}
