"""
DSPy Signature for Presentation Slides generation.
"""

import dspy
from typing import List


class SlidesSignature(dspy.Signature):
    """Generate presentation slides from research documents.

    Create a well-structured presentation with title slide, content slides
    with bullet points, and appropriate section breaks.
    """

    user_prompt: str = dspy.InputField(
        desc="User's presentation request describing the topic and audience"
    )
    research_content: str = dspy.InputField(
        desc="Combined content from research files providing context"
    )

    title: str = dspy.OutputField(
        desc="Presentation title"
    )
    subtitle: str = dspy.OutputField(
        desc="Presentation subtitle or tagline"
    )
    slides: List[dict] = dspy.OutputField(
        desc="Array of slide objects with 'title', 'type', and 'content'"
    )


class SlidesModule(dspy.Module):
    """DSPy module for slides generation with chain-of-thought reasoning."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(SlidesSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
