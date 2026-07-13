from datetime import date

from pydantic import BaseModel, Field


class GeoJsonGeometry(BaseModel):
    type: str
    coordinates: object


class GeoJsonFeature(BaseModel):
    type: str = "Feature"
    id: str | int | None = None
    geometry: GeoJsonGeometry
    properties: dict[str, object] = Field(default_factory=dict)


class GeoJsonFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoJsonFeature] = Field(default_factory=list)


class FeatureCollectionMeta(BaseModel):
    truncated: bool
    limit: int | None
    requested_zoom: int | None


class DistributionFeatureProperties(BaseModel):
    layer: str = Field(pattern="^(wild|captive|protected_area|corridor)$")
    cell_code: str
    density: float | None = None
    snapshot_date: date | None = None


class DistributionGeoJsonFeature(BaseModel):
    type: str = "Feature"
    id: str | int | None = None
    geometry: GeoJsonGeometry
    properties: DistributionFeatureProperties


class DistributionFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[DistributionGeoJsonFeature] = Field(default_factory=list)
    meta: FeatureCollectionMeta


class HabitatFeatureProperties(BaseModel):
    name: str
    province: str | None = None
    level: str | None = None


class HabitatGeoJsonFeature(BaseModel):
    type: str = "Feature"
    id: str | int | None = None
    geometry: GeoJsonGeometry
    properties: HabitatFeatureProperties


class HabitatFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[HabitatGeoJsonFeature] = Field(default_factory=list)
    meta: FeatureCollectionMeta


class DistributionSnapshot(BaseModel):
    snapshot_date: date
    version: str
    notes: str | None = None


class DistributionSnapshotList(BaseModel):
    items: list[DistributionSnapshot] = Field(default_factory=list)


class DistributionQuery(BaseModel):
    bbox: str
    snapshot_date: date | None = None
    layer: str | None = None
    zoom: int | None = None
