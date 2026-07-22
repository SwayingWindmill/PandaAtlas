from __future__ import annotations

from .runner import AdapterRegistry
from .wikimedia_commons import ADAPTER as WIKIMEDIA_COMMONS_XI_LUN_ADAPTER

DEFAULT_ADAPTER_REGISTRY = AdapterRegistry(adapters=(WIKIMEDIA_COMMONS_XI_LUN_ADAPTER,))

__all__ = ["DEFAULT_ADAPTER_REGISTRY"]
