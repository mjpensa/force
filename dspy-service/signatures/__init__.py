"""
DSPy Signatures for Force content generation.

Each signature defines the input/output schema for a content type.
"""

from .roadmap import RoadmapSignature, RoadmapModule
from .slides import SlidesSignature, SlidesModule
from .document import DocumentSignature, DocumentModule
from .research import ResearchSignature, ResearchModule

__all__ = [
    'RoadmapSignature', 'RoadmapModule',
    'SlidesSignature', 'SlidesModule',
    'DocumentSignature', 'DocumentModule',
    'ResearchSignature', 'ResearchModule',
]
