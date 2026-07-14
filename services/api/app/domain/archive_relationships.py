from __future__ import annotations

from collections import deque
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from app.domain.trusted_identity import PublicationStatus

ParentRole = Literal["father", "mother"]
ParentageStatus = Literal["confirmed", "tentative", "disputed", "superseded"]


@dataclass(frozen=True)
class ParentageAssertion:
    id: str
    child_id: UUID
    parent_id: UUID
    role: ParentRole
    status: ParentageStatus
    publication_status: PublicationStatus
    source_ids: tuple[str, ...]


@dataclass(frozen=True)
class LineageGraph:
    edges: tuple[tuple[UUID, UUID], ...]

    def parents_of(self, panda_id: UUID) -> tuple[UUID, ...]:
        return _sorted_ids(parent for parent, child in self.edges if child == panda_id)

    def children_of(self, panda_id: UUID) -> tuple[UUID, ...]:
        return _sorted_ids(child for parent, child in self.edges if parent == panda_id)

    def siblings_of(self, panda_id: UUID) -> tuple[UUID, ...]:
        parents = set(self.parents_of(panda_id))
        return _sorted_ids(
            child
            for parent, child in self.edges
            if parent in parents and child != panda_id
        )

    def grandparents_of(self, panda_id: UUID) -> tuple[UUID, ...]:
        return _sorted_ids(
            grandparent
            for parent in self.parents_of(panda_id)
            for grandparent in self.parents_of(parent)
        )

    def relationship_path(
        self,
        start_id: UUID,
        end_id: UUID,
    ) -> tuple[UUID, ...] | None:
        if start_id == end_id:
            return (start_id,)

        neighbours: dict[UUID, set[UUID]] = {}
        for parent_id, child_id in self.edges:
            neighbours.setdefault(parent_id, set()).add(child_id)
            neighbours.setdefault(child_id, set()).add(parent_id)

        queue: deque[tuple[UUID, ...]] = deque(((start_id,),))
        visited = {start_id}
        while queue:
            path = queue.popleft()
            for neighbour in sorted(neighbours.get(path[-1], ()), key=str):
                if neighbour in visited:
                    continue
                next_path = (*path, neighbour)
                if neighbour == end_id:
                    return next_path
                visited.add(neighbour)
                queue.append(next_path)
        return None


def _sorted_ids(values: Iterable[UUID]) -> tuple[UUID, ...]:
    return tuple(sorted(set(values), key=str))


def derive_lineage(assertions: tuple[ParentageAssertion, ...]) -> LineageGraph:
    edges = {
        (assertion.parent_id, assertion.child_id)
        for assertion in assertions
        if assertion.publication_status == "published"
        and assertion.status == "confirmed"
        and assertion.source_ids
    }
    return LineageGraph(edges=tuple(sorted(edges, key=lambda edge: (str(edge[0]), str(edge[1])))))
