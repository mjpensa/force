"""
DSPy Signature for Document generation.
"""

import dspy
from typing import List


class DocumentSignature(dspy.Signature):
    """Generate a structured document from research files.

    Create a professional document with title, sections, and properly
    formatted content based on the research materials.
    """

    user_prompt: str = dspy.InputField(
        desc="User's document request describing the type and purpose"
    )
    research_content: str = dspy.InputField(
        desc="Combined content from research files providing context"
    )

    title: str = dspy.OutputField(
        desc="Document title"
    )
    summary: str = dspy.OutputField(
        desc="Executive summary or abstract"
    )
    sections: List[dict] = dspy.OutputField(
        desc="Array of section objects with 'heading' and 'content'"
    )


class DocumentModule(dspy.Module):
    """DSPy module for document generation with chain-of-thought reasoning."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(DocumentSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
